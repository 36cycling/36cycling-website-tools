<?php
/**
 * Plugin Name: 36 Cycling – Shop-reparaties
 * Description: Kleine reparaties aan de webshop:
 *              1. Titel van het winkelwagen-uitschuifvenster (Blocksy) in de taal van de pagina (was overal "Shopping Cart").
 *                 (Vroeger zette dit script ook de inhoud in het venster na "Toevoegen aan winkelwagen" bij een lege start.
 *                 Blocksy 2.1.60 doet dat zelf; die reparatie zette er toen een verouderde, lege winkelwagen overheen
 *                 en is op 21 okt 2026 verwijderd.)
 *              2. Productfilter (WooCommerce-blok "Kenmerk"): waarden in de volgorde van Producten → Kenmerken
 *                 (aangepaste volgorde, bijv. XS, S, M, L, XL, 2XL) in plaats van op aantal producten. Het blok biedt
 *                 in de editor alleen "aantal" en "naam" als sortering.
 *              3. Knoptekst "In winkelwagen" in plaats van "Toevoegen aan winkelwagen" (alleen NL; EN blijft "Add to cart").
 *                 Andere knopteksten ("Opties selecteren", "Lees verder") blijven ongemoeid.
 *              4. Eigen openingszinnen in de orderbevestiging ("Bestelling in behandeling"), NL en EN. WooCommerce heeft
 *                 hier geen instelling voor; de zinnen komen uit de vertaling van WooCommerce.
 *              5. Btw-label in het Engels: "VAT" in plaats van "Btw".
 *              6. Bedankpagina (Blocksy "Thank You Pages"): van de twee Circle-vlakken alleen het passende tonen.
 *                 Groep met extra CSS-klasse "c36-circle-join" (uitnodiging) voor niet-leden, "c36-circle-member"
 *                 (welkom) voor leden en klanten die zich bij het afrekenen net hebben aangemeld.
 *              7. Productfoto's op de telefoon: stippen onder de foto, zodat je ziet dat er meer foto's zijn. Blocksy
 *                 verbergt de miniaturen onder 690 px; die tonen we hier als stippen (tikken en vegen blijven van Blocksy).
 *              8. Opzoektabel voor de maatfilter (wc_product_attributes_lookup) per taal rechtzetten. NL- en EN-maattermen
 *                 hebben dezelfde slug (xs, s, …); WooCommerce koppelt variaties op slug en pakt dan willekeurig de NL- of
 *                 EN-term, waardoor de filter met voorraad per maat sommige maten niet vond. Na elke bijwerking van de tabel
 *                 zetten we elke regel op de term in de taal van het product (via de WPML-vertaalkoppeling).
 *              9. Productpagina op de telefoon: bovenaan een terug-link naar de categorie ("‹ Fietsshirts Korte Mouw"), het
 *                 laatste stuk van de padnavigatie. De Extra CSS verbergt de hele kop (padnavigatie + titel) op mobiel; de
 *                 titel blijft onder de foto.
 * Author: 36cycling migratie
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('wp_enqueue_scripts', function () {
    if (!function_exists('WC') || is_admin()) {
        return;
    }
    $lang = apply_filters('wpml_current_language', null);
    $heading = $lang === 'en' ? 'Shopping cart' : 'Winkelwagen';
    wp_register_script('c36-shop-fixes', '', ['jquery'], '1.1', true);
    wp_enqueue_script('c36-shop-fixes');
    wp_add_inline_script('c36-shop-fixes', sprintf(<<<'JS'
(function ($) {
    var heading = %s;
    function fixHeading() {
        $('#woo-cart-panel .ct-panel-heading').text(heading);
    }
    $(fixHeading);
    $(document.body).on('added_to_cart removed_from_cart wc_fragments_refreshed wc_fragments_loaded', fixHeading);
})(jQuery);
JS
    , wp_json_encode($heading)));
}, 20);

add_filter('render_block_data', function ($block) {
    if (($block['blockName'] ?? '') === 'woocommerce/product-filter-attribute') {
        $block['attrs']['sortOrder'] = 'menu_order-asc';
    }
    return $block;
});

function c36_add_to_cart_text($text)
{
    if (apply_filters('wpml_current_language', null) === 'nl' && $text === __('Add to cart', 'woocommerce')) {
        return 'In winkelwagen';
    }
    return $text;
}
add_filter('woocommerce_product_single_add_to_cart_text', 'c36_add_to_cart_text', 20);
add_filter('woocommerce_product_add_to_cart_text', 'c36_add_to_cart_text', 20);

// Openingszinnen orderbevestiging. Taal bepalen aan de vertaling zelf: is de tekst vertaald, dan is de mail
// Nederlands; anders Engels (WCML zet bij het versturen de taal van de bestelling).
add_filter('gettext', function ($translation, $text, $domain) {
    if ($domain !== 'woocommerce') {
        return $translation;
    }
    static $lines = null;
    if ($lines === null) {
        $lines = [
            'Just to let you know &mdash; we’ve received your order, and it is now being processed.' => [
                'nl' => 'Bedankt voor je bestelling bij 36cycling.com. Je betaling is met succes verwerkt en we nemen je order direct in behandeling.',
                'en' => 'Thank you for your order at 36cycling.com. Your payment has been processed successfully and we are getting started on your order right away.',
            ],
            'Here’s a reminder of what you’ve ordered:' => [
                'nl' => 'Hieronder ter bevestiging van wat je hebt besteld:',
                'en' => 'Below is a confirmation of what you ordered:',
            ],
        ];
    }
    if (!isset($lines[$text])) {
        return $translation;
    }
    return $lines[$text][$translation !== $text ? 'nl' : 'en'];
}, 20, 3);

// Btw-label op de Engelse site (winkelwagen, afrekenen, bedankpagina, orderbevestiging): "Btw" → "VAT".
// Het label wordt bij het afrekenen in de bestelling opgeslagen, dus Engelse bestellingen houden "VAT".
add_filter('woocommerce_rate_label', function ($label) {
    return ($label === 'Btw' && apply_filters('wpml_current_language', null) === 'en') ? 'VAT' : $label;
}, 20);

// Bedankpagina: Circle-vlak voor leden of niet-leden. Buiten de bedankpagina (voorbeeld in de editor) blijven
// beide vlakken staan, zodat ze te bewerken zijn.
add_filter('render_block', function ($html, $block) {
    $class = ' ' . ($block['attrs']['className'] ?? '') . ' ';
    $join = strpos($class, ' c36-circle-join ') !== false;
    $member = strpos($class, ' c36-circle-member ') !== false;
    if ((!$join && !$member) || !function_exists('is_wc_endpoint_url') || !is_wc_endpoint_url('order-received')) {
        return $html;
    }
    static $is_member = null;
    if ($is_member === null) {
        $order = wc_get_order(absint(get_query_var('order-received')));
        $valid = $order && hash_equals($order->get_order_key(), wc_clean(wp_unslash($_GET['key'] ?? '')));
        $is_member = $valid && ($order->get_meta('_c36_circle_optin') === 'yes'
            || (function_exists('c36_circle_is_member') && c36_circle_is_member($order->get_billing_email())));
    }
    return ($member === $is_member) ? $html : '';
}, 10, 2);

// Productfoto's op de telefoon: Blocksy's miniaturen (verborgen onder 690 px) als stippen tonen. De actieve stip volgt
// Blocksy zelf (klasse "active", ook bij vegen); bij één foto maakt Blocksy geen miniaturen, dus ook geen stippen.
// "body" ervoor: de Extra CSS (Customizer) verbergt de miniaturen op mobiel (22 okt) en laadt later; zo winnen de stippen.
add_action('wp_enqueue_scripts', function () {
    if (!function_exists('is_product') || !is_product()) {
        return;
    }
    wp_register_style('c36-gallery-dots', false, [], '1.0');
    wp_enqueue_style('c36-gallery-dots');
    wp_add_inline_style('c36-gallery-dots', <<<'CSS'
@media (max-width: 689.98px) {
    body .woocommerce-product-gallery .flexy-pills { display: block; margin-top: 12px; }
    body .woocommerce-product-gallery .flexy-pills ol { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; width: auto !important; transform: none !important; }
    body .woocommerce-product-gallery .flexy-pills li { flex: 0 0 auto !important; width: 8px !important; height: 8px; margin: 0 !important; padding: 0 !important; border-radius: 50%; background: #1b2629; opacity: .25; cursor: pointer; transition: opacity .2s; }
    body .woocommerce-product-gallery .flexy-pills li.active { opacity: 1; }
    body .woocommerce-product-gallery .flexy-pills li > * { display: none !important; }
}
CSS
    );
    // Terug-link naar de categorie (zie 9 bovenaan); "body" ervoor om van de Extra CSS te winnen.
    wp_add_inline_style('c36-gallery-dots', <<<'CSS'
@media (max-width: 689.98px) {
    body.single-product .hero-section { display: block; margin-bottom: 0; padding-top: 12px; }
    body.single-product .hero-section .entry-header > :not(.ct-breadcrumbs) { display: none; }
    body.single-product .hero-section .ct-breadcrumbs { margin: 0; font-size: 13px; }
    body.single-product .hero-section .ct-breadcrumbs > span:not(.last-item) { display: none; }
    body.single-product .hero-section .ct-breadcrumbs .last-item a { display: inline-flex; align-items: center; }
    body.single-product .hero-section .ct-breadcrumbs .last-item a::before { content: "‹"; position: relative; top: -1px; margin-right: 8px; font-size: 20px; line-height: 1; }
    body.single-product .ct-container-full[data-vertical-spacing*="top"] { padding-top: 10px; }
}
CSS
    );
}, 20);

// Opzoektabel per taal rechtzetten (zie 8 bovenaan). Geeft het aantal gecorrigeerde regels terug.
function c36_fix_lookup_languages()
{
    global $wpdb;
    $icl = $wpdb->prefix . 'icl_translations';
    if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $icl)) !== $icl) {
        return 0;
    }
    return (int) $wpdb->query(
        "UPDATE {$wpdb->prefix}wc_product_attributes_lookup l
         JOIN {$icl} pt ON pt.element_id = l.product_or_parent_id AND pt.element_type = 'post_product'
         JOIN {$wpdb->term_taxonomy} tt ON tt.term_id = l.term_id AND tt.taxonomy = l.taxonomy
         JOIN {$icl} ti ON ti.element_id = tt.term_taxonomy_id AND ti.element_type = CONCAT('tax_', l.taxonomy)
         JOIN {$icl} tj ON tj.trid = ti.trid AND tj.element_type = ti.element_type AND tj.language_code = pt.language_code
         JOIN {$wpdb->term_taxonomy} tt2 ON tt2.term_taxonomy_id = tj.element_id
         SET l.term_id = tt2.term_id
         WHERE ti.language_code <> pt.language_code"
    );
}

// WooCommerce werkt de tabel bij via Action Scheduler (opnieuw genereren en per product); daarna rechtzetten.
add_action('action_scheduler_after_execute', function ($action_id, $action) {
    if (is_object($action) && method_exists($action, 'get_hook') && strpos($action->get_hook(), 'product_attribute_lookup') !== false) {
        c36_fix_lookup_languages();
    }
}, 10, 2);

// Handmatig: POST /wp-json/c36/v1/fix-lookup (beheerders).
add_action('rest_api_init', function () {
    register_rest_route('c36/v1', '/fix-lookup', [
        'methods' => 'POST',
        'permission_callback' => function () {
            return current_user_can('manage_woocommerce');
        },
        'callback' => function () {
            return ['fixed' => c36_fix_lookup_languages()];
        },
    ]);
});

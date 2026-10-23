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

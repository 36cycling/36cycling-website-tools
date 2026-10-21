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

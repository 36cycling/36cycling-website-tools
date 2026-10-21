<?php
/**
 * Plugin Name: 36 Cycling – Shop-reparaties
 * Description: Kleine reparaties aan de webshop:
 *              1. Winkelwagen-uitschuifvenster (Blocksy) werd niet bijgewerkt na "Toevoegen aan winkelwagen" als de
 *                 winkelwagen bij het laden van de pagina leeg was: het venster bevat dan de "winkelwagen is leeg"-melding
 *                 zonder het element waar WooCommerce de nieuwe inhoud in zet. Dit script zet de inhoud er alsnog in.
 *              2. Titel van het venster in de taal van de pagina (was overal "Shopping Cart").
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
    wp_register_script('c36-shop-fixes', '', ['jquery'], '1.0', true);
    wp_enqueue_script('c36-shop-fixes');
    wp_add_inline_script('c36-shop-fixes', sprintf(<<<'JS'
(function ($) {
    var heading = %s;
    function fixHeading() {
        $('#woo-cart-panel .ct-panel-heading').text(heading);
    }
    // Nieuwe mini-winkelwagen in het uitschuifvenster zetten als het vaste element ontbreekt (lege start).
    function fillPanel(fragments) {
        if (!fragments) { return; }
        var html = fragments['div.widget_shopping_cart_content'];
        var $panel = $('#woo-cart-panel .ct-panel-content-inner');
        if (html && $panel.length && !$panel.find('.widget_shopping_cart_content').length) {
            $panel.html(html);
        }
    }
    $(fixHeading);
    $(document.body).on('added_to_cart removed_from_cart', function (e, fragments) {
        fillPanel(fragments);
        fixHeading();
    });
    $(document.body).on('wc_fragments_refreshed wc_fragments_loaded', function () {
        try {
            var key = Object.keys(sessionStorage).filter(function (k) { return k.indexOf('wc_fragments_') === 0; })[0];
            if (key) { fillPanel(JSON.parse(sessionStorage.getItem(key))); }
        } catch (err) {}
        fixHeading();
    });
})(jQuery);
JS
    , wp_json_encode($heading)));
}, 20);

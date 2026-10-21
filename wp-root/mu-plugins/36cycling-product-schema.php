<?php
/**
 * Plugin Name: 36 Cycling – Product schema
 * Description: Zorgt dat WooCommerce Product-structured data (product, prijs, voorraad) op productpagina's
 *              wordt uitgestuurd. Nodig omdat de productpagina via Blocksy/Greenshift is opgebouwd, waardoor
 *              de standaard WooCommerce-hook (woocommerce_single_product_summary) die de productdata
 *              verzamelt niet draait. Vult het schema aan met merk en conditie, zoals op de oude site.
 * Author: 36cycling migratie
 */

// 1. Productdata alsnog laten verzamelen vlak vóór WooCommerce het schema uitstuurt (wp_footer, prio 10).
add_action('wp_footer', function () {
    if (!function_exists('is_product') || !is_product() || !function_exists('WC')) {
        return;
    }
    $sd = WC()->structured_data ?? null;
    if (!$sd || !method_exists($sd, 'generate_product_data')) {
        return;
    }
    // Al aanwezig (bijv. als het thema de standaard-hook later wél aanroept)? Dan niets doen.
    $data = method_exists($sd, 'get_data') ? (array) $sd->get_data() : [];
    foreach ($data as $item) {
        if (is_array($item) && ($item['@type'] ?? '') === 'Product') {
            return;
        }
    }
    $product = wc_get_product(get_queried_object_id());
    if ($product) {
        $sd->generate_product_data($product);
    }
    // Vangnet: als de standaard uitvoer niet (meer) aan wp_footer hangt, zelf uitsturen.
    if (!has_action('wp_footer', [$sd, 'output_structured_data'])) {
        $sd->output_structured_data();
    }
}, 5);

// 2. Merk en conditie toevoegen (stond ook in het schema van de oude site).
add_filter('woocommerce_structured_data_product', function ($markup, $product) {
    if (empty($markup['brand'])) {
        $markup['brand'] = ['@type' => 'Brand', 'name' => '36 Cycling'];
    }
    if (!empty($markup['offers']) && is_array($markup['offers'])) {
        foreach ($markup['offers'] as &$offer) {
            if (is_array($offer) && empty($offer['itemCondition'])) {
                $offer['itemCondition'] = 'https://schema.org/NewCondition';
            }
        }
        unset($offer);
    }
    return $markup;
}, 10, 2);

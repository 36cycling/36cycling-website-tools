<?php
/**
 * Plugin Name: 36 Cycling – TIJDELIJK: diagnose maatfilter met opzoektabel
 * Description: Alleen voor beheerders. (1) GET /wp-json/c36/v1/debug-lookup?product=ID: maattermen met taal en de inhoud
 *              van de opzoektabel (wc_product_attributes_lookup) voor pa_maat. (2) ?c36_lookup=1 op een winkelpagina: zet de
 *              opzoektabel alleen voor deze beheerder aan en bewaart de productquery (uitlezen via dezelfde route).
 *              Bezoekers merken er niets van. Na de diagnose verwijderen (28 okt 2026).
 * Author: 36cycling migratie
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('init', function () {
    if (is_admin() || empty($_GET['c36_lookup']) || !current_user_can('manage_woocommerce')) {
        return;
    }
    add_filter('pre_option_woocommerce_attribute_lookup_enabled', function () {
        return 'yes';
    });
    add_filter('posts_request', function ($sql, $query) {
        if ($query->is_main_query()) {
            set_transient('c36_lookup_sql', ['url' => $_SERVER['REQUEST_URI'], 'sql' => $sql], HOUR_IN_SECONDS);
        }
        return $sql;
    }, 9999, 2);
});

add_action('rest_api_init', function () {
    register_rest_route('c36/v1', '/debug-lookup', [
        'methods' => 'GET',
        'permission_callback' => function () {
            return current_user_can('manage_woocommerce');
        },
        'callback' => function (WP_REST_Request $r) {
            global $wpdb;
            $lookup = $wpdb->prefix . 'wc_product_attributes_lookup';
            $terms = $wpdb->get_results(
                "SELECT t.term_id, tt.term_taxonomy_id, t.slug, t.name, tt.count, i.language_code AS lang, i.trid
                 FROM {$wpdb->terms} t
                 JOIN {$wpdb->term_taxonomy} tt ON tt.term_id = t.term_id AND tt.taxonomy = 'pa_maat'
                 LEFT JOIN {$wpdb->prefix}icl_translations i ON i.element_id = tt.term_taxonomy_id AND i.element_type = 'tax_pa_maat'
                 WHERE t.slug IN ('xs','s','m','l','xl','2xl','3xl','2xs') OR t.slug LIKE 'xs-%' OR t.slug LIKE 's-%' OR t.slug LIKE 'l-%' OR t.slug LIKE '2xl-%'
                 ORDER BY t.slug, i.language_code",
                ARRAY_A
            );
            $counts = $wpdb->get_results(
                "SELECT l.term_id, t.slug, l.is_variation_attribute AS var, l.in_stock, COUNT(*) AS n
                 FROM {$lookup} l LEFT JOIN {$wpdb->terms} t ON t.term_id = l.term_id
                 WHERE l.taxonomy = 'pa_maat' GROUP BY l.term_id, l.is_variation_attribute, l.in_stock ORDER BY t.slug",
                ARRAY_A
            );
            $out = [
                'terms' => $terms,
                'lookup_counts' => $counts,
                'lookup_total' => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$lookup}"),
                'options' => [
                    'enabled' => get_option('woocommerce_attribute_lookup_enabled'),
                    'direct_updates' => get_option('woocommerce_attribute_lookup_direct_updates'),
                    'regen_in_progress' => get_option('woocommerce_attribute_lookup_regeneration_in_progress'),
                    'last_product_id' => get_option('woocommerce_attribute_lookup_last_product_id_to_process'),
                ],
                'last_query' => get_transient('c36_lookup_sql'),
            ];
            $pid = absint($r->get_param('product'));
            if ($pid) {
                $out['product_rows'] = $wpdb->get_results($wpdb->prepare(
                    "SELECT l.*, t.slug FROM {$lookup} l LEFT JOIN {$wpdb->terms} t ON t.term_id = l.term_id
                     WHERE l.product_or_parent_id = %d ORDER BY l.taxonomy, t.slug",
                    $pid
                ), ARRAY_A);
            }
            return $out;
        },
    ]);
});

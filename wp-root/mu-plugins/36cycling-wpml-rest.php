<?php
/**
 * Plugin Name: 36 Cycling – WPML REST-koppeling
 * Description: Kleine REST-endpoints om vertalingen (pagina's, berichten, termen) aan het Nederlandse origineel te
 *              koppelen in WPML, zodat taalwisselaar en hreflang kloppen. Alleen voor beheerders (Application Password).
 *              GET  /wp-json/c36/v1/translations?element_type=post_page&id=123
 *              POST /wp-json/c36/v1/link {element_type, source_id, translation_id, lang, source_lang}
 *              POST /wp-json/c36/v1/string-translation {context, lang, strings: {naam: vertaling}}
 *              element_type: post_page | post_post | post_product | tax_category | tax_product_cat | …
 * Author: 36cycling migratie
 */

if (!defined('ABSPATH')) {
    exit;
}

/** Element-id zoals WPML het gebruikt: post-ID, of term_taxonomy_id bij termen. */
function c36_wpml_element_id($element_type, $id)
{
    if (strpos($element_type, 'tax_') !== 0) {
        return (int) $id;
    }
    $term = get_term((int) $id, substr($element_type, 4));
    return ($term && !is_wp_error($term)) ? (int) $term->term_taxonomy_id : 0;
}

function c36_wpml_translations($element_type, $trid)
{
    $out = [];
    foreach ((array) apply_filters('wpml_get_element_translations', null, $trid, $element_type) as $lang => $t) {
        $out[$lang] = [
            'element_id' => (int) $t->element_id,
            'term_id'    => isset($t->term_id) ? (int) $t->term_id : null,
            'original'   => (bool) $t->original,
        ];
    }
    return $out;
}

add_action('rest_api_init', function () {
    $can = function () {
        return current_user_can('manage_options');
    };

    register_rest_route('c36/v1', '/translations', [
        'methods'             => 'GET',
        'permission_callback' => $can,
        'callback'            => function ($req) {
            $type = sanitize_text_field($req['element_type']);
            $el = c36_wpml_element_id($type, $req['id']);
            $trid = $el ? apply_filters('wpml_element_trid', null, $el, $type) : null;
            if (!$trid) {
                return new WP_Error('c36_no_trid', 'Element niet gevonden in WPML.', ['status' => 404]);
            }
            return ['trid' => (int) $trid, 'translations' => c36_wpml_translations($type, $trid)];
        },
    ]);

    // Blocksy-instellingen (waar/wanneer een contentblok verschijnt) van origineel naar vertaling kopiëren.
    register_rest_route('c36/v1', '/copy-meta', [
        'methods'             => 'POST',
        'permission_callback' => $can,
        'callback'            => function ($req) {
            $from = (int) $req['from'];
            $to = (int) $req['to'];
            if (!get_post($from) || !get_post($to)) {
                return new WP_Error('c36_not_found', 'Bericht niet gevonden.', ['status' => 404]);
            }
            $copied = [];
            foreach (get_post_meta($from) as $key => $values) {
                if (strpos($key, 'blocksy') !== 0) {
                    continue;
                }
                delete_post_meta($to, $key);
                foreach ($values as $v) {
                    add_post_meta($to, $key, maybe_unserialize($v));
                }
                $copied[] = $key;
            }
            return ['copied' => $copied];
        },
    ]);

    // Vertalingen van losse strings (WPML String Translation), bv. de teksten van de Complianz-cookiebalk.
    //   POST {context, lang, strings: {naam: vertaling, ...}}
    register_rest_route('c36/v1', '/string-translation', [
        'methods'             => 'POST',
        'permission_callback' => $can,
        'callback'            => function ($req) {
            global $wpdb;
            if (!function_exists('icl_add_string_translation')) {
                return new WP_Error('c36_no_st', 'WPML String Translation is niet actief.', ['status' => 400]);
            }
            $context = sanitize_text_field($req['context']);
            $lang = sanitize_key($req['lang']);
            $out = [];
            foreach ((array) $req['strings'] as $name => $value) {
                $id = (int) $wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}icl_strings WHERE context = %s AND name = %s", $context, $name));
                if (!$id) {
                    $out[$name] = 'niet gevonden';
                    continue;
                }
                icl_add_string_translation($id, $lang, wp_kses_post($value), defined('ICL_TM_COMPLETE') ? ICL_TM_COMPLETE : 10);
                $out[$name] = 'ok';
            }
            return $out;
        },
    ]);

    register_rest_route('c36/v1', '/link', [
        'methods'             => 'POST',
        'permission_callback' => $can,
        'callback'            => function ($req) {
            $type = sanitize_text_field($req['element_type']);
            $lang = sanitize_key($req['lang']);
            $source_lang = sanitize_key($req['source_lang'] ?: 'nl');
            $src = c36_wpml_element_id($type, $req['source_id']);
            $tr = c36_wpml_element_id($type, $req['translation_id']);
            if (!$src || !$tr || !$lang) {
                return new WP_Error('c36_bad_request', 'source_id, translation_id en lang zijn verplicht.', ['status' => 400]);
            }
            $trid = apply_filters('wpml_element_trid', null, $src, $type);
            if (!$trid) {
                return new WP_Error('c36_no_trid', 'Het origineel heeft geen WPML-taalgegevens.', ['status' => 400]);
            }
            do_action('wpml_set_element_language_details', [
                'element_id'           => $tr,
                'element_type'         => $type,
                'trid'                 => $trid,
                'language_code'        => $lang,
                'source_language_code' => $source_lang,
            ]);
            return ['trid' => (int) $trid, 'translations' => c36_wpml_translations($type, $trid)];
        },
    ]);
});

// Namen van producteigenschappen op de Engelse site (Maat → Size enz.).
add_filter('woocommerce_attribute_label', function ($label) {
    if (apply_filters('wpml_current_language', null) !== 'en') {
        return $label;
    }
    $en = [
        'Maat'       => 'Size',
        'Maat broek' => 'Size',
        'Maat shirt' => 'Size',
        'Aantal'     => 'Quantity',
        'Aanbieding' => 'Offer',
    ];
    return $en[$label] ?? $label;
}, 20);

// ---------------------------------------------------------------------------------------------
// SEO van productcategorieën.
//   POST /wp-json/c36/v1/term-seo {taxonomy, term_id, title, metadesc, focuskw, cleanup}
//   Schrijft de standaard Yoast-velden van de term, in de taal van de term (anders zet WPML het id om naar NL).
//   Daarna de term opslaan (bv. via /wp/v2/product_cat/{id}?lang=..) zodat Yoast zijn indexable bijwerkt.
//   cleanup=true verwijdert de oude tijdelijke term meta (c36_seo_title/_desc/_text).
// De SEO-tekst staat in het standaard beschrijvingsveld en wordt onder de producten getoond.
// ---------------------------------------------------------------------------------------------
add_action('rest_api_init', function () {
    register_rest_route('c36/v1', '/term-seo', [
        'methods'             => 'POST',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
        'callback'            => function ($req) {
            global $wpdb;
            $tax = sanitize_key($req['taxonomy'] ?: 'product_cat');
            $id = (int) $req['term_id'];
            $tt_id = (int) $wpdb->get_var($wpdb->prepare("SELECT term_taxonomy_id FROM {$wpdb->term_taxonomy} WHERE term_id = %d AND taxonomy = %s", $id, $tax));
            if (!$tt_id) {
                return new WP_Error('c36_not_found', 'Term niet gevonden.', ['status' => 404]);
            }
            $lang = apply_filters('wpml_element_language_code', null, ['element_id' => $tt_id, 'element_type' => $tax]);
            if ($lang) {
                do_action('wpml_switch_language', $lang);
            }
            $yoast = [];
            foreach (['title' => 'wpseo_title', 'metadesc' => 'wpseo_desc', 'focuskw' => 'wpseo_focuskw'] as $in => $key) {
                if ($req[$in] !== null) {
                    $yoast[$key] = sanitize_text_field($req[$in]);
                }
            }
            // Yoast bewaart term-SEO in de optie wpseo_taxonomy_meta. Buiten het beheerscherm filtert WPML die optie
            // (vertaalde termen krijgen de waarden van het origineel), dus rechtstreeks in de database lezen/schrijven.
            $read_raw = function () use ($wpdb) {
                $raw = $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name = %s", 'wpseo_taxonomy_meta'));
                $val = $raw ? maybe_unserialize($raw) : [];
                return is_array($val) ? $val : [];
            };
            if ($yoast) {
                $all = $read_raw();
                $all[$tax][$id] = array_merge($all[$tax][$id] ?? [], $yoast);
                $wpdb->update($wpdb->options, ['option_value' => maybe_serialize($all)], ['option_name' => 'wpseo_taxonomy_meta']);
                wp_cache_delete('wpseo_taxonomy_meta', 'options');
                wp_cache_delete('alloptions', 'options');
                wp_cache_delete('notoptions', 'options');
                // Yoasts indexable (bron voor <title>/meta op de pagina) direct bijwerken; opnieuw opbouwen buiten
                // het beheerscherm zou weer de door WPML gefilterde (Nederlandse) waarden gebruiken.
                $cols = [];
                if (isset($yoast['wpseo_title'])) {
                    $cols['title'] = $yoast['wpseo_title'];
                }
                if (isset($yoast['wpseo_desc'])) {
                    $cols['description'] = $yoast['wpseo_desc'];
                }
                if ($cols) {
                    $wpdb->update($wpdb->prefix . 'yoast_indexable', $cols, ['object_id' => $id, 'object_type' => 'term', 'object_sub_type' => $tax]);
                }
            }
            if ($req['cleanup']) {
                foreach (['c36_seo_title', 'c36_seo_desc', 'c36_seo_text'] as $key) {
                    delete_term_meta($id, $key);
                }
            }
            $raw_now = $read_raw();
            $stored = $raw_now[$tax][$id] ?? [];
            return ['term_id' => $id, 'lang' => $lang, 'title' => $stored['wpseo_title'] ?? null, 'metadesc' => $stored['wpseo_desc'] ?? null];
        },
    ]);
});

// Beschrijving van een term mét opmaak (H2, alinea's, lijsten) opslaan. Via de gewone REST-route haalt WordPress
// alle HTML weg (kses voor termbeschrijvingen); hier wordt het gefilterd met de regels voor berichten (wp_kses_post).
//   POST /wp-json/c36/v1/term-description {taxonomy, term_id, description}
add_action('rest_api_init', function () {
    register_rest_route('c36/v1', '/term-description', [
        'methods'             => 'POST',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
        'callback'            => function ($req) {
            global $wpdb;
            $tax = sanitize_key($req['taxonomy'] ?: 'product_cat');
            $id = (int) $req['term_id'];
            $description = wp_kses_post((string) $req['description']);
            $updated = $wpdb->update($wpdb->term_taxonomy, ['description' => $description], ['term_id' => $id, 'taxonomy' => $tax]);
            if ($updated === false) {
                return new WP_Error('c36_db', 'Opslaan mislukt.', ['status' => 500]);
            }
            clean_term_cache($id, $tax);
            $stored = (string) $wpdb->get_var($wpdb->prepare("SELECT description FROM {$wpdb->term_taxonomy} WHERE term_id = %d AND taxonomy = %s", $id, $tax));
            return ['term_id' => $id, 'length' => strlen($stored), 'h2' => substr_count($stored, '<h2')];
        },
    ]);
});

function c36_category_seo_text()
{
    static $done = false;
    if ($done || !function_exists('is_product_category') || !is_product_category() || is_paged()) {
        return;
    }
    // Standaard beschrijvingsveld van de categorie (Producten → Categorieën).
    $term = get_queried_object();
    $text = trim((string) ($term->description ?? ''));
    if ($text === '') {
        return;
    }
    if (!preg_match('/<(p|h[1-6]|ul|ol|div)\b/i', $text)) {
        $text = wpautop($text);
    }
    $done = true;
    // Koppen in deze tekst kleiner dan de standaard-H2 van het thema (40px), met ruimte erboven.
    echo '<style>.c36-category-seo h2{font-size:clamp(1.3rem,1.15rem + .5vw,1.6rem);line-height:1.25;margin:1.8em 0 .5em}'
        . '.c36-category-seo h2:first-child{margin-top:0}.c36-category-seo h3{font-size:1.15rem;line-height:1.3;margin:1.5em 0 .4em}</style>';
    echo '<div class="c36-category-seo entry-content" style="margin-top:4em;max-width:900px">' . wp_kses_post($text) . '</div>';
}
// Onder de productlijst; valt terug op het einde van de hoofdinhoud als het thema de eerste hook niet gebruikt.
add_action('woocommerce_after_shop_loop', 'c36_category_seo_text', 20);
add_action('woocommerce_after_main_content', 'c36_category_seo_text', 5);

// ---------------------------------------------------------------------------------------------
// Beschikbare updates (voor de wekelijkse controle zonder ingelogde beheerder).
//   GET /wp-json/c36/v1/updates[?refresh=1]
//   Geeft WordPress-, plugin-, thema- en vertaalupdates terug, plus de huidige versies. Alleen lezen;
//   refresh=1 laat WordPress eerst opnieuw bij de updateservers (ook WPML/Blocksy Pro) controleren.
// ---------------------------------------------------------------------------------------------
add_action('rest_api_init', function () {
    register_rest_route('c36/v1', '/updates', [
        'methods'             => 'GET',
        'permission_callback' => function () {
            return current_user_can('update_plugins');
        },
        'callback'            => function ($req) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
            if ($req['refresh']) {
                wp_version_check([], true);
                wp_update_plugins();
                wp_update_themes();
            }
            global $wp_version;
            $core = [];
            foreach ((array) get_core_updates(['dismissed' => false]) as $u) {
                if (isset($u->response) && $u->response === 'upgrade') {
                    $core[] = ['version' => $u->version, 'locale' => $u->locale];
                }
            }
            $all = get_plugins();
            $plugins = [];
            $pt = get_site_transient('update_plugins');
            foreach ((array) ($pt->response ?? []) as $file => $u) {
                $plugins[] = [
                    'file'    => $file,
                    'name'    => $all[$file]['Name'] ?? $file,
                    'current' => $all[$file]['Version'] ?? '',
                    'new'     => $u->new_version ?? '',
                    'active'  => is_plugin_active($file),
                    'url'     => $u->url ?? '',
                ];
            }
            $themes = [];
            $tt = get_site_transient('update_themes');
            foreach ((array) ($tt->response ?? []) as $slug => $u) {
                $t = wp_get_theme($slug);
                $themes[] = [
                    'slug'    => $slug,
                    'name'    => $t->get('Name'),
                    'current' => $t->get('Version'),
                    'new'     => $u['new_version'] ?? '',
                    'active'  => get_stylesheet() === $slug || get_template() === $slug,
                ];
            }
            return [
                'checked'      => gmdate('c', (int) ($pt->last_checked ?? 0)),
                'wordpress'    => $wp_version,
                'php'          => PHP_VERSION,
                'core'         => $core,
                'plugins'      => $plugins,
                'themes'       => $themes,
                'translations' => count((array) wp_get_translation_updates()),
                'inactive_themes' => array_values(array_filter(array_keys(wp_get_themes()), function ($s) {
                    return $s !== get_stylesheet() && $s !== get_template();
                })),
            ];
        },
    ]);
});

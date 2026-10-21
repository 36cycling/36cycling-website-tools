<?php
/**
 * Plugin Name: 36 Cycling – Productfeed
 * Description: Productfeed (Google/Facebook-RSS) in hetzelfde formaat als de oude Umbraco-feed, voor Channable (→ bol.com)
 *              en de Facebook-catalogus. Zelfde adres als op de oude site: /umbraco/api/site/getFacebookFeed, zodat na de
 *              domeinwissel in Channable/Facebook niets hoeft te veranderen. Alias: /productfeed.xml.
 *              Id's gelijk aan de oude feed (<oud productnummer>-<maat>): meta _c36_feed_id op de variatie (of het enkelvoudige
 *              product), _c36_feed_group en _c36_feed_gender op het hoofdproduct; gezet met scripts/feed-map.mjs via de route
 *              c36/v1/feed-map. Nieuwe producten krijgen hun SKU als id. Alleen gepubliceerde Nederlandse producten.
 *              15 minuten in de cache; opnieuw opgebouwd zodra een product of voorraad wijzigt.
 * Author: 36cycling migratie
 */

if (!defined('ABSPATH')) {
    exit;
}

const C36_FEED_PATHS = ['/umbraco/api/site/getfacebookfeed', '/productfeed.xml'];
const C36_FEED_CACHE = 'c36_product_feed';
const C36_FEED_META = ['_c36_feed_id', '_c36_feed_group', '_c36_feed_gender'];

// Feed uitserveren. wp_loaded: WooCommerce is geladen, maar WPML/Redirection hebben de URL nog niet afgehandeld.
add_action('wp_loaded', function () {
    $path = strtolower(rtrim((string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
    if (!in_array($path, C36_FEED_PATHS, true) || !function_exists('wc_get_products')) {
        return;
    }
    $xml = get_transient(C36_FEED_CACHE);
    if ($xml === false) {
        $xml = c36_feed_build();
        set_transient(C36_FEED_CACHE, $xml, 15 * MINUTE_IN_SECONDS);
    }
    nocache_headers();
    header('X-LiteSpeed-Cache-Control: no-cache');
    header('X-Robots-Tag: noindex');
    header('Content-Type: application/xml; charset=utf-8');
    echo $xml;
    exit;
});

// Cache legen bij wijzigingen aan producten, variaties of voorraad (ook door bestellingen).
foreach ([
    'woocommerce_new_product', 'woocommerce_update_product', 'woocommerce_update_product_variation',
    'woocommerce_delete_product', 'woocommerce_trash_product', 'woocommerce_product_set_stock', 'woocommerce_variation_set_stock',
] as $hook) {
    add_action($hook, function () {
        delete_transient(C36_FEED_CACHE);
    });
}

// Feed-id's niet meekopiëren bij dupliceren (anders twee producten met hetzelfde id).
add_filter('woocommerce_duplicate_product_exclude_meta', function ($keys) {
    return array_merge((array) $keys, C36_FEED_META);
});
add_filter('duplicate_post_excludelist_filter', function ($keys) {
    return array_merge((array) $keys, C36_FEED_META);
});

function c36_feed_build()
{
    do_action('wpml_switch_language', 'nl');
    $ids = wc_get_products([
        'status' => 'publish', 'limit' => -1, 'return' => 'ids', 'orderby' => 'ID', 'order' => 'ASC', 'suppress_filters' => false,
    ]);
    $nl = chr(10);
    $items = [];
    $used = [];
    foreach ($ids as $id) {
        $lang = apply_filters('wpml_element_language_code', null, ['element_id' => $id, 'element_type' => 'product']);
        if ($lang && $lang !== 'nl') {
            continue;
        }
        $p = wc_get_product($id);
        if (!$p || $p->get_catalog_visibility() === 'hidden') {
            continue;
        }
        $base = [
            'gender'      => metadata_exists('post', $id, '_c36_feed_gender') ? get_post_meta($id, '_c36_feed_gender', true) : c36_feed_gender($p),
            'title'       => $p->get_name(),
            'description' => c36_feed_text($p->get_description() ?: $p->get_short_description()),
            'link'        => get_permalink($id),
            'gallery'     => array_filter(array_map('wp_get_attachment_url', $p->get_gallery_image_ids())),
        ];
        if ($p->is_type('variable')) {
            $group = get_post_meta($id, '_c36_feed_group', true) ?: ($p->get_sku() ?: (string) $id);
            foreach ($p->get_children() as $vid) {
                $v = wc_get_product($vid);
                if (!$v || $v->get_status() !== 'publish' || $v->get_regular_price() === '') {
                    continue;
                }
                $items[] = c36_feed_item($base + [
                    'id'    => c36_feed_id($vid, $v->get_sku(), $used),
                    'group' => $group,
                    'size'  => c36_feed_size($v),
                    'image' => wp_get_attachment_url($v->get_image_id() ?: $p->get_image_id()),
                ], $v);
            }
        } elseif ($p->get_regular_price() !== '') {
            $items[] = c36_feed_item($base + [
                'id'    => c36_feed_id($id, $p->get_sku(), $used),
                'image' => wp_get_attachment_url($p->get_image_id()),
            ], $p);
        }
    }
    return '<?xml version="1.0"?>' . $nl
        . '<rss xmlns:g="http://base.google.com/ns/1.0" version="2">' . $nl
        . '  <channel>' . $nl
        . '    <title>36Cycling</title>' . $nl
        . '    <link>' . c36_feed_esc(home_url('/')) . '</link>' . $nl
        . '    <description>All products available in the website</description>' . $nl
        . implode('', $items)
        . '  </channel>' . $nl
        . '</rss>' . $nl;
}

// Eén <item>, velden en volgorde als in de oude feed.
function c36_feed_item(array $d, WC_Product $v)
{
    $nl = chr(10);
    $tag = function ($name, $value) use ($nl) {
        $value = (string) $value;
        return $value === '' ? "      <g:$name />$nl" : "      <g:$name>" . c36_feed_esc($value) . "</g:$name>$nl";
    };
    $price = function ($amount) {
        return number_format((float) $amount, 2, '.', '') . ' EUR';
    };
    $out = '    <item>' . $nl
        . $tag('gender', $d['gender'])
        . $tag('id', $d['id'])
        . (isset($d['group']) ? $tag('item_group_id', $d['group']) : '')
        . $tag('title', $d['title'])
        . $tag('description', $d['description'])
        . $tag('link', $d['link'])
        . ($d['gallery'] ? $tag('additional_image_link', implode(';', $d['gallery'])) : '')
        . $tag('ean', method_exists($v, 'get_global_unique_id') ? $v->get_global_unique_id() : '')
        . $tag('image_link', $d['image'] ?: '')
        . $tag('brand', '36Cycling')
        . $tag('condition', 'new')
        // De oude feed meldde altijd "in stock" (ook bij voorraad 0); aanpassen kan met dit filter.
        . $tag('availability', apply_filters('c36_feed_availability', 'in stock', $v))
        . ($v->is_on_sale() && $v->get_sale_price() !== '' ? $tag('sale_price', $price($v->get_sale_price())) : '')
        . $tag('price', $price($v->get_regular_price()))
        . '      <g:shipping>' . $nl
        . '        <g:country>NL</g:country>' . $nl
        . '        <g:service>Standard</g:service>' . $nl
        . '        <g:price>0.00 EUR</g:price>' . $nl
        . '      </g:shipping>' . $nl
        . $tag('google_product_category', 'Kleding')
        . $tag('custom_label_0', '')
        . (isset($d['size']) ? $tag('size', $d['size']) : '')
        . $tag('quantity_to_sell_on_facebook', $v->managing_stock() ? (int) $v->get_stock_quantity() : 0)
        . '    </item>' . $nl;
    return $out;
}

// Id uit de oude feed; anders de SKU; nooit twee keer hetzelfde id.
function c36_feed_id($post_id, $sku, array &$used)
{
    $id = (string) get_post_meta($post_id, '_c36_feed_id', true);
    if ($id === '' || isset($used[$id])) {
        $id = (string) $sku;
    }
    if ($id === '' || isset($used[$id])) {
        $id = 'wc-' . $post_id;
    }
    $used[$id] = true;
    return $id;
}

// Maat (en bij sokken het aantal) als leesbare tekst, bijv. "XL" of "S/M - 3 paar".
function c36_feed_size(WC_Product $v)
{
    $parts = [];
    foreach ($v->get_attributes() as $taxonomy => $value) {
        if ($value === '') {
            continue;
        }
        $term = taxonomy_exists($taxonomy) ? get_term_by('slug', $value, $taxonomy) : false;
        $parts[] = $term ? $term->name : $value;
    }
    return implode(' - ', $parts);
}

// Voor nieuwe producten zonder opgeslagen waarde: afleiden uit categorieën en naam.
function c36_feed_gender(WC_Product $p)
{
    $terms = get_the_terms($p->get_id(), 'product_cat');
    $text = strtolower($p->get_name() . ' ' . implode(' ', wp_list_pluck(is_array($terms) ? $terms : [], 'name')));
    $women = strpos($text, 'dames') !== false;
    $men = strpos($text, 'heren') !== false;
    if ($women && !$men) {
        return 'Vrouw';
    }
    if ($men && !$women) {
        return 'Man';
    }
    return 'Unisex';
}

// HTML-omschrijving → platte tekst met regeleinden (zoals de oude feed).
function c36_feed_text($html)
{
    $nl = chr(10);
    $html = preg_replace('#<(br|/p|/h[1-6]|/li|/div)[^>]*>#i', '$0' . $nl, strip_shortcodes((string) $html));
    $text = html_entity_decode(wp_strip_all_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $lines = array_map('trim', explode($nl, str_replace(chr(13), '', $text)));
    $text = implode($nl, $lines);
    $text = preg_replace('#' . $nl . '{3,}#', $nl . $nl, $text);
    return trim($text);
}

function c36_feed_esc($value)
{
    return htmlspecialchars((string) $value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

// Koppeling oude feed-id's → producten (scripts/feed-map.mjs).
add_action('rest_api_init', function () {
    register_rest_route('c36/v1', '/feed-map', [
        'methods'             => 'POST',
        'permission_callback' => function () {
            return current_user_can('manage_woocommerce');
        },
        'callback'            => function ($req) {
            $n = 0;
            foreach ((array) $req['items'] as $post_id => $meta) {
                $post_id = (int) $post_id;
                if (!in_array(get_post_type($post_id), ['product', 'product_variation'], true)) {
                    continue;
                }
                foreach (C36_FEED_META as $key) {
                    if (isset($meta[$key])) {
                        update_post_meta($post_id, $key, sanitize_text_field($meta[$key]));
                    }
                }
                $n++;
            }
            delete_transient(C36_FEED_CACHE);
            return ['updated' => $n];
        },
    ]);
});

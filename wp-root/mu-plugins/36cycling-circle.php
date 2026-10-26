<?php
/**
 * Plugin Name: 36 Cycling – Circle
 * Description: Voordelen voor leden van de 36 Cycling Circle (FluentCRM-lijst "36 Cycling Circle"), herkend op
 *              e-mailadres bij het afrekenen: 10% korting (WooCommerce-kortingscode "circle", automatisch toegepast),
 *              gratis Circle-sokken bij bestellingen vanaf € 50 (keuzeveld bij het afrekenen) en een vinkje
 *              "Meld me aan voor de 36 Cycling Circle". Geschreven voor de WooCommerce blok-checkout.
 * Author: 36cycling migratie
 */

if (!defined('ABSPATH')) {
    exit;
}

const C36_CIRCLE_LIST      = '36-cycling-circle';   // slug FluentCRM-lijst
const C36_CIRCLE_TAG       = 'aanmelding-checkout'; // slug FluentCRM-tag voor aanmeldingen via het afrekenvinkje
const C36_CIRCLE_COUPON    = 'circle';              // WooCommerce-kortingscode (10%)
const C36_CIRCLE_SOCKS     = 5218;                  // variabel product "Wielersokken - Dry Knit, CIRCLE"
const C36_CIRCLE_THRESHOLD = 50;                    // gratis sokken vanaf dit bedrag (incl. btw, vóór korting)
const C36_CIRCLE_FORM      = 3;                     // Fluent Forms-aanmeldformulier
const C36_F_SOCKS          = 'c36/circle-sokken';
const C36_F_OPTIN          = 'c36/circle-aanmelden';

/** Tekst in de taal van de bezoeker (WPML): Engels op de Engelse site, anders Nederlands. */
function c36_t($nl, $en)
{
    return apply_filters('wpml_current_language', null) === 'en' ? $en : $nl;
}

/** Is dit e-mailadres lid van de Circle (staat het in de FluentCRM-lijst)? Afgemeld voor mail = nog steeds lid. */
function c36_circle_is_member($email)
{
    static $cache = [];
    $email = strtolower(trim((string) $email));
    if (!$email || !is_email($email)) {
        return false;
    }
    if (isset($cache[$email])) {
        return $cache[$email];
    }
    global $wpdb;
    $s = $wpdb->prefix . 'fc_subscribers';
    $p = $wpdb->prefix . 'fc_subscriber_pivot';
    $l = $wpdb->prefix . 'fc_lists';
    $suppress = $wpdb->suppress_errors(true);
    $found = $wpdb->get_var($wpdb->prepare(
        "SELECT 1 FROM {$s} s
         JOIN {$p} p ON p.subscriber_id = s.id AND p.object_type LIKE %s
         JOIN {$l} l ON l.id = p.object_id
         WHERE s.email = %s AND l.slug = %s LIMIT 1",
        '%Lists',
        $email,
        C36_CIRCLE_LIST
    ));
    $wpdb->suppress_errors($suppress);
    return $cache[$email] = (bool) $found;
}

/** E-mailadres van de huidige klant (winkelwagen/checkout). */
function c36_circle_customer_email()
{
    $email = (function_exists('WC') && WC()->customer) ? WC()->customer->get_billing_email() : '';
    if (!$email && is_user_logged_in()) {
        $email = wp_get_current_user()->user_email;
    }
    return $email;
}

/** Productbedrag van de winkelwagen incl. btw, vóór korting. */
function c36_circle_cart_goods_total()
{
    if (!function_exists('WC') || !WC()->cart) {
        return 0;
    }
    return (float) WC()->cart->get_subtotal() + (float) WC()->cart->get_subtotal_tax();
}

// ---------------------------------------------------------------------------------------------
// 1. Korting: code "circle" alleen geldig voor leden, en automatisch toevoegen/verwijderen.
// ---------------------------------------------------------------------------------------------

add_filter('woocommerce_coupon_is_valid', function ($valid, $coupon, $discounts = null) {
    if (!$valid || strtolower($coupon->get_code()) !== C36_CIRCLE_COUPON) {
        return $valid;
    }
    $object = ($discounts && method_exists($discounts, 'get_object')) ? $discounts->get_object() : null;
    $email = ($object instanceof WC_Order) ? $object->get_billing_email() : c36_circle_customer_email();
    if (!c36_circle_is_member($email)) {
        throw new Exception(c36_t('De Circle-korting is alleen voor leden van de 36 Cycling Circle.', 'The Circle discount is only for members of the 36 Cycling Circle.'), 100);
    }
    return true;
}, 10, 3);

function c36_circle_sync_coupon($recalculate = true)
{
    static $busy = false;
    if ($busy || !function_exists('WC') || !WC()->cart || !WC()->customer) {
        return;
    }
    $busy = true;
    try {
        $member = c36_circle_is_member(c36_circle_customer_email());
        $applied = WC()->cart->get_applied_coupons();
        $has = in_array(C36_CIRCLE_COUPON, $applied, true);
        if ($member && !$has) {
            WC()->cart->set_applied_coupons(array_merge($applied, [C36_CIRCLE_COUPON]));
        } elseif (!$member && $has) {
            WC()->cart->set_applied_coupons(array_values(array_diff($applied, [C36_CIRCLE_COUPON])));
        } else {
            return;
        }
        if ($recalculate) {
            WC()->cart->calculate_totals();
        }
    } catch (\Throwable $e) {
        error_log('[36cycling-circle] coupon: ' . $e->getMessage());
    } finally {
        $busy = false;
    }
}

// Blok-checkout: klant vult e-mailadres in → adres wordt naar de server gestuurd (totalen worden daarna herberekend).
add_action('woocommerce_store_api_cart_update_customer_from_request', function () {
    c36_circle_sync_coupon(false);
});
// Bij het plaatsen van de bestelling nogmaals (laatste e-mailadres telt).
add_action('woocommerce_store_api_checkout_update_customer_from_request', function () {
    c36_circle_sync_coupon(true);
});
// Terugkerende sessie / ingelogde klant.
add_action('woocommerce_cart_loaded_from_session', function () {
    c36_circle_sync_coupon(false);
}, 20);

// ---------------------------------------------------------------------------------------------
// 2. Extra velden in de blok-checkout: gratis sokken (keuze maat/kleur) en aanmelden voor de Circle.
//    De winkelwagen (Store API) krijgt extra gegevens "c36-circle": member (lid) en socks (lid én vanaf € 50).
//    Daarmee toont de checkout het sokkenveld alleen aan leden vanaf € 50 en het aanmeldvinkje alleen aan niet-leden.
// ---------------------------------------------------------------------------------------------

add_action('woocommerce_blocks_loaded', function () {
    if (!function_exists('woocommerce_store_api_register_endpoint_data')) {
        return;
    }
    woocommerce_store_api_register_endpoint_data([
        'endpoint'        => \Automattic\WooCommerce\StoreApi\Schemas\V1\CartSchema::IDENTIFIER,
        'namespace'       => 'c36-circle',
        'data_callback'   => function () {
            $member = c36_circle_is_member(c36_circle_customer_email());
            return ['member' => $member, 'socks' => $member && c36_circle_cart_goods_total() >= C36_CIRCLE_THRESHOLD];
        },
        'schema_callback' => function () {
            return [
                'member' => ['description' => 'Klant is lid van de 36 Cycling Circle', 'type' => 'boolean', 'readonly' => true],
                'socks'  => ['description' => 'Klant heeft recht op gratis Circle-sokken', 'type' => 'boolean', 'readonly' => true],
            ];
        },
        'schema_type'     => ARRAY_A,
    ]);
});

/** Voorwaarde voor 'hidden' van een checkoutveld: verbergen tenzij c36-circle.$key in de winkelwagen true is. */
function c36_circle_hidden_unless($key)
{
    return ['cart' => ['properties' => ['extensions' => ['properties' => ['c36-circle' => ['properties' => [
        $key => ['not' => ['const' => true]],
    ]]]]]]];
}

/** Maat-term "S/M - zwart" → "Zwart, maat S/M" / "Black, size S/M". */
function c36_circle_sock_label($name)
{
    $parts = array_map('trim', explode(' - ', $name, 2));
    if (count($parts) !== 2) {
        return $name;
    }
    [$size, $color] = $parts;
    $en = ['zwart' => 'Black', 'wit' => 'White'];
    return c36_t(ucfirst($color) . ', maat ' . $size, ($en[strtolower($color)] ?? ucfirst($color)) . ', size ' . $size);
}

add_action('woocommerce_init', function () {
    if (!function_exists('woocommerce_register_additional_checkout_field')) {
        return;
    }
    try {
        // Variaties en maatnamen rechtstreeks uit de database: bij woocommerce_init zijn producttypes en
        // kenmerk-taxonomieën nog niet geregistreerd.
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT p.ID,
                    MAX(CASE WHEN m.meta_key = '_stock_status' THEN m.meta_value END) AS stock,
                    MAX(CASE WHEN m.meta_key = 'attribute_pa_maat' THEN t.name END) AS label
             FROM {$wpdb->posts} p
             JOIN {$wpdb->postmeta} m ON m.post_id = p.ID
             LEFT JOIN {$wpdb->term_taxonomy} tt ON m.meta_key = 'attribute_pa_maat' AND tt.taxonomy = 'pa_maat'
                 AND tt.term_taxonomy_id IN (SELECT tr.term_taxonomy_id FROM {$wpdb->term_relationships} tr WHERE tr.object_id = p.post_parent)
             LEFT JOIN {$wpdb->terms} t ON t.term_id = tt.term_id AND t.slug = m.meta_value
             WHERE p.post_parent = %d AND p.post_type = 'product_variation' AND p.post_status IN ('publish', 'private')
             GROUP BY p.ID ORDER BY p.menu_order, p.ID",
            C36_CIRCLE_SOCKS
        ));
        $options = [];
        foreach ((array) $rows as $row) {
            if ($row->stock !== 'outofstock' && $row->label) {
                $options[] = ['value' => (string) $row->ID, 'label' => c36_circle_sock_label($row->label)];
            }
        }
        if ($options) {
            $label = c36_t('Je gratis Circle-sokken', 'Your free Circle socks');
            woocommerce_register_additional_checkout_field([
                'id'            => C36_F_SOCKS,
                'label'         => $label,
                'optionalLabel' => $label,
                'placeholder'   => c36_t('Kies kleur en maat', 'Choose colour and size'),
                'location'      => 'order',
                'type'          => 'select',
                'required'      => false,
                'options'       => $options,
                'hidden'        => c36_circle_hidden_unless('socks'),
                // Niet op de bedankpagina/in de mail: de gekozen sokken staan al als orderregel.
                'show_in_order_confirmation' => false,
            ]);
        }
        $optin = c36_t('Meld me gratis aan voor de 36 Cycling Circle: 10% korting en gratis sokken bij je volgende bestellingen', 'Sign me up for the 36 Cycling Circle for free: 10% off and free socks on my next orders');
        woocommerce_register_additional_checkout_field([
            'id'            => C36_F_OPTIN,
            'label'         => $optin,
            'optionalLabel' => $optin,
            'location'      => 'order',
            'type'          => 'checkbox',
            // Niet op de bedankpagina/in de mail ("Nee" is verwarrend voor wie al lid is); waarde blijft in de bestelling.
            'show_in_order_confirmation' => false,
            'hidden'        => ['cart' => ['properties' => ['extensions' => ['properties' => ['c36-circle' => ['properties' => [
                'member' => ['const' => true],
            ]]]]]]],
        ]);
    } catch (\Throwable $e) {
        error_log('[36cycling-circle] velden: ' . $e->getMessage());
    }
});

// Sokken gekozen terwijl je (nog) geen recht hebt → duidelijke melding.
add_action('woocommerce_validate_additional_field', function ($errors, $key, $value) {
    if ($key !== C36_F_SOCKS || $value === '' || $value === null) {
        return;
    }
    if (!c36_circle_is_member(c36_circle_customer_email())) {
        $errors->add('c36_circle_sokken', c36_t('Gratis sokken zijn alleen voor leden van de 36 Cycling Circle. Laat het sokkenveld leeg, of meld je eerst aan op onze Circle-pagina.', 'Free socks are only for members of the 36 Cycling Circle. Leave the socks field empty, or sign up on our Circle page first.'));
    } elseif (c36_circle_cart_goods_total() < C36_CIRCLE_THRESHOLD) {
        $errors->add('c36_circle_sokken', c36_t('Gratis Circle-sokken krijg je bij bestellingen vanaf € 50. Laat het sokkenveld leeg.', 'You get free Circle socks on orders from € 50. Leave the socks field empty.'));
    }
}, 10, 3);

// Bestelling wordt aangemaakt/bijgewerkt vanuit de checkout: gratis sokken als regel van € 0 toevoegen.
add_action('woocommerce_store_api_checkout_update_order_from_request', function ($order, $request) {
    try {
        foreach ($order->get_items() as $item_id => $item) {
            if ($item->get_meta('_c36_circle_gratis')) {
                $order->remove_item($item_id);
            }
        }
        $fields = (array) ($request['additional_fields'] ?? []);
        $order->update_meta_data('_c36_circle_optin', !empty($fields[C36_F_OPTIN]) ? 'yes' : 'no');

        $vid = absint($fields[C36_F_SOCKS] ?? 0);
        $goods = 0;
        foreach ($order->get_items() as $item) {
            $goods += (float) $item->get_subtotal() + (float) $item->get_subtotal_tax();
        }
        if ($vid && $goods >= C36_CIRCLE_THRESHOLD && c36_circle_is_member($order->get_billing_email())) {
            $v = wc_get_product($vid);
            if ($v && (int) $v->get_parent_id() === C36_CIRCLE_SOCKS && $v->is_in_stock()) {
                $new_id = $order->add_product($v, 1, ['subtotal' => 0, 'total' => 0]);
                $new = $order->get_item($new_id);
                if ($new) {
                    $new->add_meta_data('_c36_circle_gratis', 'yes', true);
                    $new->add_meta_data('Circle', c36_t('Gratis Circle-sokken', 'Free Circle socks'), true);
                    $new->save();
                }
            }
        }
        $order->calculate_totals();
        $order->save();
    } catch (\Throwable $e) {
        error_log('[36cycling-circle] sokken: ' . $e->getMessage());
    }
}, 10, 2);

// Na het plaatsen: aanmelden voor de Circle als het vinkje aan stond.
add_action('woocommerce_store_api_checkout_order_processed', function ($order) {
    try {
        if ($order->get_meta('_c36_circle_optin') !== 'yes' || !function_exists('FluentCrmApi')) {
            return;
        }
        $email = $order->get_billing_email();
        $list = \FluentCrm\App\Models\Lists::where('slug', C36_CIRCLE_LIST)->first();
        $tag = \FluentCrm\App\Models\Tag::where('slug', C36_CIRCLE_TAG)->first();
        if (!$list || !is_email($email)) {
            return;
        }
        $api = FluentCrmApi('contacts');
        $contact = $api->getContact($email);
        if ($contact) {
            $contact->attachLists([$list->id]);
            if ($tag) {
                $contact->attachTags([$tag->id]);
            }
        } else {
            $api->createOrUpdate([
                'email'      => $email,
                'first_name' => $order->get_billing_first_name(),
                'last_name'  => $order->get_billing_last_name(),
                'status'     => 'subscribed',
                'lists'      => [$list->id],
                'tags'       => $tag ? [$tag->id] : [],
            ]);
        }
        $order->add_order_note('Klant aangemeld voor de 36 Cycling Circle via het vinkje bij het afrekenen.');
    } catch (\Throwable $e) {
        error_log('[36cycling-circle] aanmelden: ' . $e->getMessage());
    }
});

// ---------------------------------------------------------------------------------------------
// 3. Bevestigingstekst van het aanmeldformulier op /nl/36-cycling-circle/.
// ---------------------------------------------------------------------------------------------

add_filter('fluentform/submission_confirmation', function ($data, $form) {
    if ((int) ($form->id ?? 0) !== C36_CIRCLE_FORM) {
        return $data;
    }
    $data['message'] = '<p><strong>Welkom bij de 36 Cycling Circle!</strong></p>'
        . '<p>Je bent aangemeld. Vanaf nu krijg je met dit e-mailadres bij elke bestelling in onze webshop 10% korting '
        . 'op de collectie en gratis fietssokken bij bestellingen vanaf € 50.</p>';
    return $data;
}, 10, 2);

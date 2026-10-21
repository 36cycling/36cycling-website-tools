<?php
/**
 * Plugin Name: 36 Cycling – Import oude webshop
 * Description: Eenmalige import van klanten en bestellingen uit de oude Umbraco-webshop (36cycling.com) naar WooCommerce.
 *              POST /wp-json/c36/v1/legacy-import  (alleen beheerders, Application Password)
 *              - maakt het klantaccount aan (zonder wachtwoordmail) of gebruikt het bestaande account met dat e-mailadres
 *              - maakt de bestelling aan als "Afgerond", met originele datum en oud ordernummer
 *              - tijdens de import gaan er GEEN e-mails uit en verandert de voorraad NIET
 *              - idempotent: een bestelling met hetzelfde oude ID wordt niet dubbel aangemaakt ("replace" bouwt hem opnieuw op)
 *              Na de import mag deze plugin weer weg.
 * Author: 36cycling migratie
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route('c36/v1', '/legacy-import', [
        'methods'             => 'POST',
        'permission_callback' => function () {
            return current_user_can('manage_woocommerce');
        },
        'callback'            => 'c36_legacy_import',
    ]);
});

/** Tijdens de import: geen mail, geen voorraadmutaties. */
function c36_legacy_quiet()
{
    // WooCommerce-mails uitschakelen (dan probeert WC ze ook niet en komt er geen "kon niet verzonden"-notitie);
    // pre_wp_mail als extra vangnet voor andere plugins.
    foreach (WC()->mailer()->get_emails() as $email) {
        add_filter('woocommerce_email_enabled_' . $email->id, '__return_false', 999);
    }
    add_filter('pre_wp_mail', '__return_false', 999);
    foreach (['completed', 'processing', 'on-hold'] as $status) {
        remove_action('woocommerce_order_status_' . $status, 'wc_maybe_reduce_stock_levels');
    }
    remove_action('woocommerce_payment_complete', 'wc_maybe_reduce_stock_levels');
    remove_action('woocommerce_order_status_cancelled', 'wc_maybe_increase_stock_levels');
    remove_action('woocommerce_order_status_pending', 'wc_maybe_increase_stock_levels');
}

function c36_legacy_customer($c)
{
    $email = sanitize_email($c['email'] ?? '');
    if (!is_email($email)) {
        return new WP_Error('c36_email', 'Ongeldig e-mailadres.', ['status' => 400]);
    }
    $user = get_user_by('email', $email);
    $created = false;
    if (!$user) {
        $login = sanitize_user(current(explode('@', $email)), true) ?: 'klant';
        $base = $login;
        $i = 1;
        while (username_exists($login)) {
            $login = $base . $i++;
        }
        $first = sanitize_text_field($c['first_name'] ?? '');
        $last = sanitize_text_field($c['last_name'] ?? '');
        $uid = wp_insert_user([
            'user_login'   => $login,
            'user_email'   => $email,
            'user_pass'    => wp_generate_password(32, true, true),
            'first_name'   => $first,
            'last_name'    => $last,
            'display_name' => trim($first . ' ' . $last) ?: $login,
            'role'         => 'customer',
        ]);
        if (is_wp_error($uid)) {
            return $uid;
        }
        update_user_meta($uid, '_c36_legacy_customer', 1);
        $created = true;
    } else {
        $uid = $user->ID;
    }
    // Adressen alleen invullen waar het account nog niets heeft (nooit gegevens van de klant overschrijven).
    $customer = new WC_Customer($uid);
    foreach (['billing', 'shipping'] as $type) {
        foreach ((array) ($c[$type] ?? []) as $key => $value) {
            $get = "get_{$type}_{$key}";
            $set = "set_{$type}_{$key}";
            if (method_exists($customer, $set) && $customer->$get() === '' && $value !== '') {
                $customer->$set(sanitize_text_field($value));
            }
        }
    }
    $customer->save();
    return ['id' => $uid, 'created' => $created];
}

function c36_legacy_import(WP_REST_Request $req)
{
    c36_legacy_quiet();
    $legacy_id = sanitize_text_field((string) $req['legacy_id']);
    if ($legacy_id === '') {
        return new WP_Error('c36_id', 'legacy_id ontbreekt.', ['status' => 400]);
    }
    $cust = c36_legacy_customer((array) $req['customer']);
    if (is_wp_error($cust)) {
        return $cust;
    }

    $existing = wc_get_orders(['limit' => 1, 'return' => 'ids', 'meta_query' => [['key' => '_c36_legacy_id', 'value' => $legacy_id]]]);
    if ($existing && !$req['replace']) {
        return ['order_id' => (int) $existing[0], 'customer_id' => $cust['id'], 'customer_created' => $cust['created'], 'status' => 'bestond al'];
    }
    if ($existing) {
        $order = wc_get_order($existing[0]);
        $order->remove_order_items();
    } else {
        $order = new WC_Order();
    }

    $order->set_customer_id($cust['id']);
    $order->set_created_via('c36-legacy-import');
    $order->set_currency('EUR');
    $order->set_prices_include_tax(true);
    foreach (['billing', 'shipping'] as $type) {
        foreach ((array) ($req[$type] ?? []) as $key => $value) {
            $set = "set_{$type}_{$key}";
            if (method_exists($order, $set)) {
                $order->$set(sanitize_text_field($value));
            }
        }
    }
    $order->set_payment_method('');
    $order->set_payment_method_title(sanitize_text_field($req['payment_title'] ?: 'Oude webshop'));
    $order->set_transaction_id(sanitize_text_field((string) $req['legacy_ref']));

    foreach ((array) $req['items'] as $it) {
        $item = new WC_Order_Item_Product();
        $item->set_name(sanitize_text_field($it['name']));
        $item->set_quantity(max(1, (int) $it['qty']));
        if (!empty($it['product_id']) && wc_get_product((int) $it['product_id'])) {
            $item->set_product_id((int) $it['product_id']);
        }
        $total = wc_format_decimal($it['total'], 2);
        $item->set_subtotal($total);
        $item->set_total($total);
        foreach ((array) ($it['meta'] ?? []) as $k => $v) {
            if ($v !== '') {
                $item->add_meta_data(sanitize_text_field($k), sanitize_text_field($v), true);
            }
        }
        $order->add_item($item);
    }
    foreach ((array) $req['fees'] as $f) {
        $fee = new WC_Order_Item_Fee();
        $fee->set_name(sanitize_text_field($f['name']));
        $fee->set_tax_status('none');
        $fee->set_total(wc_format_decimal($f['total'], 2));
        $order->add_item($fee);
    }
    if ((float) $req['shipping_total'] !== 0.0 || $req['shipping_title']) {
        $ship = new WC_Order_Item_Shipping();
        $ship->set_method_title(sanitize_text_field($req['shipping_title'] ?: 'Verzendkosten'));
        $ship->set_total(wc_format_decimal($req['shipping_total'], 2));
        $order->add_item($ship);
    }

    $order->calculate_totals(false);
    $order->set_total(wc_format_decimal($req['total'], 2));

    $ts = strtotime((string) $req['date'] . ' Europe/Amsterdam') ?: time();
    $order->set_date_created($ts);
    $order->set_date_paid($ts);
    $order->set_date_completed($ts);
    $order->set_status('completed');
    $order->update_meta_data('_c36_legacy_id', $legacy_id);
    $order->update_meta_data('_c36_legacy_ref', sanitize_text_field((string) $req['legacy_ref']));
    if ($req['language']) {
        $order->update_meta_data('wpml_language', sanitize_key($req['language']));
    }
    $order->save();
    if (!$existing) {
        $order->add_order_note(sprintf('Geïmporteerd uit de oude webshop (36cycling.com, Umbraco). Oud ordernummer: %s', sanitize_text_field((string) $req['legacy_ref'])));
    }
    return [
        'order_id'         => $order->get_id(),
        'customer_id'      => $cust['id'],
        'customer_created' => $cust['created'],
        'total'            => $order->get_total(),
        'status'           => $existing ? 'opnieuw opgebouwd' : 'aangemaakt',
    ];
}

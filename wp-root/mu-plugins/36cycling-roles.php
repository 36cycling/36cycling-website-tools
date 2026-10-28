<?php
/**
 * Plugin Name: 36 Cycling – Rollen
 * Description: Rol "Webshopmedewerker" voor collega's: bestellingen afhandelen (status, notities, terugbetalen via Mollie)
 *              en producten bewerken (voorraad, prijzen, teksten, foto's). Geen pagina's, Stories, menu's, Customizer,
 *              plugins of instellingen; producten en bestellingen verwijderen kan ook niet.
 * Author: 36cycling migratie
 */

if (!defined('ABSPATH')) {
    exit;
}

const C36_ROLE = 'c36_webshop';
const C36_ROLE_VERSION = 1; // ophogen na een wijziging in de rechten hieronder

add_action('init', function () {
    if ((int) get_option('c36_role_version') === C36_ROLE_VERSION && get_role(C36_ROLE)) {
        return;
    }
    remove_role(C36_ROLE);
    add_role(C36_ROLE, 'Webshopmedewerker', [
        'read'                       => true,
        'view_admin_dashboard'       => true, // anders stuurt WooCommerce de gebruiker weg uit wp-admin
        'upload_files'               => true, // productfoto's
        'view_woocommerce_reports'   => true, // WooCommerce-overzicht en Analytics
        // Bestellingen
        'read_shop_order'            => true,
        'read_private_shop_orders'   => true,
        'edit_shop_orders'           => true,
        'edit_others_shop_orders'    => true,
        'edit_published_shop_orders' => true,
        'edit_private_shop_orders'   => true,
        'publish_shop_orders'        => true,
        // Producten (inclusief varianten, voorraad en prijzen)
        'read_product'               => true,
        'read_private_products'      => true,
        'edit_products'              => true,
        'edit_others_products'       => true,
        'edit_published_products'    => true,
        'edit_private_products'      => true,
        'publish_products'           => true,
        'assign_product_terms'       => true,
    ]);
    update_option('c36_role_version', C36_ROLE_VERSION);
});

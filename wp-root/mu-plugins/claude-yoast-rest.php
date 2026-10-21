<?php
/**
 * Plugin Name: Claude Migratie – Yoast REST meta
 * Description: Zet Yoast SEO-velden (titel, meta-description, focus keyword, canonical)
 *              open voor de WordPress REST API, zodat ze via de migratie gezet kunnen worden.
 * Author: 36cycling migratie
 */

add_action('init', function () {
    $keys = [
        '_yoast_wpseo_title',
        '_yoast_wpseo_metadesc',
        '_yoast_wpseo_focuskw',
        '_yoast_wpseo_canonical',
        '_yoast_wpseo_meta-robots-noindex',
    ];
    // Van toepassing op zowel pagina's als (straks) producten/berichten.
    foreach (['page', 'post'] as $type) {
        foreach ($keys as $key) {
            register_post_meta($type, $key, [
                'show_in_rest'  => true,
                'single'        => true,
                'type'          => 'string',
                'auth_callback' => function () {
                    return current_user_can('edit_posts');
                },
            ]);
        }
    }
}, 20);

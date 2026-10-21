<?php
/**
 * Plugin Name: 36 Cycling – Google Tag Manager
 * Description: Laadt de bestaande GTM-container van 36cycling.com (GTM-PQ7TPFC). Google Analytics 4, Google Ads,
 *              Meta-pixel, Hotjar en Clarity staan ín die container; die dus niet nog eens los toevoegen (dubbele metingen).
 *              Alleen actief op het productiedomein (36cycling.com), zodat de testsite geen meetdata vervuilt.
 *              Consent Mode v2: standaard alles "denied"; de keuze uit de Complianz-cookiebalk wordt doorgegeven
 *              (statistieken → analytics_storage, marketing → ad_*). Complianz zet daarnaast de events
 *              cmplz_event_statistics / cmplz_event_marketing in de dataLayer (triggers voor Meta, Hotjar e.d. in GTM).
 *              Niet voor ingelogde beheerders/winkelmanagers (eigen bezoeken tellen niet mee).
 * Author: 36cycling migratie
 */

if (!defined('ABSPATH')) {
    exit;
}

const C36_GTM_ID = 'GTM-PQ7TPFC';
const C36_GTM_HOSTS = ['36cycling.com', 'www.36cycling.com'];

function c36_tracking_enabled()
{
    static $on = null;
    if ($on === null) {
        $host = strtolower(wp_parse_url(home_url(), PHP_URL_HOST) ?: '');
        $on = in_array($host, C36_GTM_HOSTS, true) && !is_admin() && !current_user_can('manage_woocommerce');
        // Uitzetten of op de testsite aanzetten: add_filter('c36_tracking_enabled', '__return_true');
        $on = (bool) apply_filters('c36_tracking_enabled', $on);
    }
    return $on;
}

add_action('wp_head', function () {
    if (!c36_tracking_enabled()) {
        return;
    }
    ?>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', functionality_storage: 'granted', security_storage: 'granted', wait_for_update: 500});
gtag('set', 'ads_data_redaction', true);
// Keuze uit de cookiebalk (Complianz) doorgeven aan Google Consent Mode.
(function () {
    function update(categories) {
        var stats = categories.indexOf('statistics') > -1 ? 'granted' : 'denied';
        var ads = categories.indexOf('marketing') > -1 ? 'granted' : 'denied';
        gtag('consent', 'update', {analytics_storage: stats, ad_storage: ads, ad_user_data: ads, ad_personalization: ads});
    }
    document.addEventListener('cmplz_fire_categories', function (e) {
        update((e.detail && e.detail.categories) || []);
    });
    document.addEventListener('cmplz_revoke', function () {
        update([]);
    });
})();
</script>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','<?php echo esc_js(C36_GTM_ID); ?>');</script>
<!-- End Google Tag Manager -->
    <?php
}, 1);

add_action('wp_body_open', function () {
    if (!c36_tracking_enabled()) {
        return;
    }
    printf(
        '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=%s" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>',
        esc_attr(C36_GTM_ID)
    );
}, 1);

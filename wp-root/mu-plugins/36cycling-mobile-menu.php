<?php
/**
 * Plugin Name: 36 Cycling – Mobiel menu
 * Description: Mobiel menu (Blocksy off-canvas) als "drill-down" zoals bij grote webshops: links uitgelijnd, één niveau
 *              tegelijk, submenu schuift in beeld met een Terug-knop en bovenaan "Bekijk alles". Bouwt op het bestaande
 *              Blocksy-menu (zelfde menu-items, WPML-taal); zonder JavaScript blijft het gewone Blocksy-menu staan.
 * Author: 36cycling migratie
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('wp_footer', function () {
    if (is_admin()) {
        return;
    }
    ?>
<style id="c36-drill-css">
#offcanvas nav.mobile-menu[data-c36-drill] { display: none; }
#offcanvas .ct-panel-content-inner:has(.c36-drill) { justify-content: flex-start; padding-top: 15px; padding-bottom: 20px; }
#offcanvas .c36-drill ~ .ct-header-socials { margin-top: 28px; } /* compact, zodat Instagram ook op kleine telefoons in beeld staat */
.c36-drill { position: relative; flex-shrink: 0; width: 100%; max-width: 480px; overflow: hidden; text-align: left; } /* flex-shrink: anders knijpt Blocksy het menu op kleine schermen af in plaats van te scrollen */
.c36-drill-panel { position: absolute; top: 0; left: 0; width: 100%; transform: translateX(100%); transition: transform .28s ease; }
.c36-drill-panel.is-active { position: relative; transform: none; } /* het actieve niveau bepaalt de hoogte, zonder meten */
.c36-drill-panel.is-behind { transform: translateX(-100%); }
.c36-drill ul { list-style: none; margin: 0; padding: 0; }
.c36-drill li { margin: 0; border-bottom: 1px solid rgba(255, 255, 255, .14); }
.c36-drill a, .c36-drill-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 14px 2px; color: #fff; background: none; border: 0; font: inherit; font-size: 17px; font-weight: 500; text-align: left; text-decoration: none; cursor: pointer; }
.c36-drill a.c36-drill-all { font-weight: 700; }
.c36-drill a.c36-drill-cta { justify-content: center; margin-top: 20px; padding: 14px 20px; color: #1b2629; background: #ffb8b5; border-radius: 3px; font-size: 16px; font-weight: 600; }
.c36-drill-back { display: flex; align-items: center; gap: 6px; padding: 6px 0; color: #fff; opacity: .75; background: none; border: 0; font: inherit; font-size: 15px; cursor: pointer; }
.c36-drill-back svg { transform: rotate(180deg); }
.c36-drill-title { padding: 6px 2px 12px; color: #fff; font-size: 24px; font-weight: 700; border-bottom: 1px solid rgba(255, 255, 255, .14); }
</style>
<script id="c36-drill-js">
(function () {
    var nav = document.querySelector('#offcanvas nav.mobile-menu');
    if (!nav || nav.dataset.c36Drill) return;
    nav.dataset.c36Drill = '1';
    var en = (document.documentElement.lang || '').indexOf('en') === 0;
    var T = { back: en ? 'Back' : 'Terug', all: en ? 'View all' : 'Bekijk alles' };
    var chevron = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    var wrap = document.createElement('div');
    wrap.className = 'c36-drill';
    var stack = [];

    function link(href, text, cls) {
        var a = document.createElement('a');
        a.href = href;
        a.textContent = text;
        if (cls) a.className = cls;
        return a;
    }
    function panel(ul, title, href) {
        var p = document.createElement('div');
        p.className = 'c36-drill-panel';
        if (title) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'c36-drill-back';
            b.innerHTML = chevron + '<span>' + T.back + '</span>';
            b.addEventListener('click', back);
            var h = document.createElement('div');
            h.className = 'c36-drill-title';
            h.textContent = title;
            p.append(b, h);
        }
        var list = document.createElement('ul');
        if (href) {
            var li0 = document.createElement('li');
            li0.appendChild(link(href, T.all, 'c36-drill-all'));
            list.appendChild(li0);
        }
        var cta = null;
        ul.querySelectorAll(':scope > li').forEach(function (src) {
            var a = src.querySelector(':scope > a, :scope > .ct-sub-menu-parent > a');
            var sub = src.querySelector(':scope > ul');
            if (!a) return;
            // Offerte aanvragen / Request a quote: als roze knop onder het hoofdmenu
            if (!title && !sub && /offerte|quote/i.test(a.href)) {
                cta = link(a.href, a.textContent.trim(), 'c36-drill-cta');
                return;
            }
            var li = document.createElement('li');
            if (sub) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'c36-drill-item';
                btn.innerHTML = '<span></span>' + chevron;
                btn.firstChild.textContent = a.textContent.trim();
                btn.addEventListener('click', function () { open(panel(sub, a.textContent.trim(), a.href)); });
                li.appendChild(btn);
            } else {
                li.appendChild(link(a.href, a.textContent.trim()));
            }
            list.appendChild(li);
        });
        p.appendChild(list);
        if (cta) p.appendChild(cta);
        return p;
    }
    function open(p) {
        var cur = stack[stack.length - 1];
        wrap.appendChild(p);
        stack.push(p);
        p.offsetWidth; // reflow, zodat de overgang start
        if (cur) cur.classList.replace('is-active', 'is-behind');
        p.classList.add('is-active');
        toTop();
    }
    function toTop() {
        var sc = wrap.closest('.ct-panel-content-inner');
        if (sc) sc.scrollTop = 0;
    }
    function back() {
        if (stack.length < 2) return;
        var cur = stack.pop(), prev = stack[stack.length - 1];
        cur.classList.remove('is-active');
        prev.classList.replace('is-behind', 'is-active');
        toTop();
        setTimeout(function () { cur.remove(); }, 300);
    }
    nav.parentNode.insertBefore(wrap, nav);
    open(panel(nav.querySelector('ul'), '', ''));

    // Menu gesloten: volgende keer weer op het hoofdniveau beginnen
    var oc = document.getElementById('offcanvas');
    new MutationObserver(function () {
        if (oc.classList.contains('active') || stack.length < 2) return;
        while (stack.length > 1) stack.pop().remove();
        stack[0].classList.replace('is-behind', 'is-active');
    }).observe(oc, { attributes: true, attributeFilter: ['class'] });
})();
</script>
    <?php
}, 99);

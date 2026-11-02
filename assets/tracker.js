/* Traceur malary.eu — privacy-first, AVEC CONSENTEMENT (PRÉPARÉ, NON DÉPLOYÉ).
 * Projet DÉDIÉ malary-web-stats. Schéma à compteurs PLATS (+1 par requête).
 *
 * CONSENTEMENT (exigé) :
 *   - RIEN n'est chargé avant acceptation : ni reCAPTCHA, ni App Check, ni
 *     écriture Firestore. Le site fonctionne NORMALEMENT en cas de refus.
 *   - Choix Accepter / Refuser via une bannière ; retrait possible à tout moment
 *     (window.malaryConsent.withdraw()).
 *   - reCAPTCHA Enterprise (Fraud Defense) traite des données personnelles (IP,
 *     comportement, cookie Google) → d'où ce consentement préalable.
 *
 * TEST ISOLÉ : ?ms_test=1 (ou localStorage ms_test=1) écrit dans la collection
 *   `web_stats_test` — JAMAIS mélangée aux stats publiques `web_stats`.
 */
(function () {
  // À renseigner lors de l'activation (console Firebase — valeurs publiques).
  var firebaseConfig = {
    apiKey: "AIzaSyC-W80gKkTK5PdZzuyTK_FOWG34iFvFOMw",
    projectId: "malary-web-stats",
    appId: "1:85352680879:web:e6cada45a6e9bffa31735a",
  };
  // App Check : reCAPTCHA ENTERPRISE (Fraud Defense). Clé de site (publique).
  var RECAPTCHA_ENTERPRISE_SITE_KEY = "6LfJrgwuAAAAACkoh1yr2Y42eiMcAzEw7e6Fj6HQ";
  // Reste no-op tant que la clé reCAPTCHA Enterprise n'est pas fournie.
  if (RECAPTCHA_ENTERPRISE_SITE_KEY.indexOf("__") === 0 || firebaseConfig.apiKey.indexOf("__") === 0) return;

  var CONSENT_KEY = "malary_consent";                 // 'yes' | 'no' | null
  // Mode test (écrit dans web_stats_test) : drapeau de PAGE (non persistant,
  // ne pollue pas les visites réelles) OU ?ms_test=1 OU localStorage ms_test=1.
  var TEST = (typeof window !== "undefined" && window.__MS_FORCE_TEST__ === true)
    || /[?&]ms_test=1/.test(location.search) || localStorage.getItem("ms_test") === "1";
  var COLLECTION = TEST ? "web_stats_test" : "web_stats";
  var started = false;

  function status() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }

  // ── API de consentement (appelable par la bannière et une page légale) ──────
  window.malaryConsent = {
    status: status,
    accept: function () { try { localStorage.setItem(CONSENT_KEY, "yes"); } catch (e) {} removeBanner(); start(); },
    refuse: function () { try { localStorage.setItem(CONSENT_KEY, "no"); } catch (e) {} removeBanner(); /* rien chargé */ },
    withdraw: function () { try { localStorage.removeItem(CONSENT_KEY); } catch (e) {} location.reload(); },
  };

  // ── Bannière minimale (injectée seulement si consentement non défini) ───────
  function showBanner() {
    if (document.getElementById("ms-consent")) return;
    var b = document.createElement("div");
    b.id = "ms-consent";
    b.setAttribute("role", "dialog");
    b.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#111;color:#eee;padding:14px 18px;font:14px/1.5 system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;box-shadow:0 -2px 12px rgba(0,0,0,.4)";
    b.innerHTML = '<span style="max-width:720px">Nous utilisons une mesure d\'audience protégée par <b>Google reCAPTCHA</b> ' +
      '(dépôt d\'un cookie Google et traitement de données techniques). Elle ne se charge qu\'avec votre accord. ' +
      '<a href="/legal.html" style="color:#9cf">En savoir plus</a>.</span>' +
      '<span style="display:flex;gap:8px">' +
      '<button type="button" id="ms-refuse" style="padding:8px 16px;border:0;background:#555;color:#fff;border-radius:6px;font:inherit;cursor:pointer">Refuser</button>' +
      '<button type="button" id="ms-accept" style="padding:8px 16px;border:0;background:#4a9b6f;color:#fff;border-radius:6px;font:inherit;cursor:pointer">Accepter</button>' +
      '</span>';
    (document.body || document.documentElement).appendChild(b);
    document.getElementById("ms-accept").addEventListener("click", window.malaryConsent.accept);
    document.getElementById("ms-refuse").addEventListener("click", window.malaryConsent.refuse);
  }
  function removeBanner() { var b = document.getElementById("ms-consent"); if (b) b.remove(); }

  // ── Collecte (chargée UNIQUEMENT après acceptation) ─────────────────────────
  function start() {
    if (started) return; started = true;
    Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"),
    ]).then(function (m) {
      var appMod = m[0], ac = m[1], fs = m[2];
      var app = appMod.initializeApp(firebaseConfig);
      ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY), isTokenAutoRefreshEnabled: true });
      var db = fs.getFirestore(app), inc = fs.increment;
      function today() { return new Date().toISOString().slice(0, 10); }
      function bump(field) { var d = { date: today(), updatedAt: fs.serverTimestamp() }; d[field] = inc(1); return fs.setDoc(fs.doc(db, COLLECTION, today()), d, { merge: true }).catch(function () {}); }
      function once(k2) { var k = "ms_" + k2 + "_" + today(); if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, "1"); return true; }
      function source() {
        var r = (document.referrer || "").toLowerCase();
        if (!r) return "direct";
        if (r.indexOf("linkedin") > -1 || r.indexOf("lnkd.in") > -1) return "linkedin";
        if (r.indexOf("instagram") > -1) return "instagram";
        if (r.indexOf("facebook") > -1 || r.indexOf("fb.com") > -1 || r.indexOf("fb.me") > -1) return "facebook";
        if (r.indexOf("google.") > -1) return "google";
        try { if (new URL(r).hostname.indexOf("malary.eu") > -1) return null; } catch (e) {}
        return "autre";
      }
      bump("pageviews");
      if (once("src")) { var s = source(); if (s) bump("src_" + s); }
      // Vues de SECTION — on observe le CONTENU réel, jamais les menus :
      //  • 6 Flows = cartes de contenu `.flow-card[data-id]` (les boutons de
      //    menu sont des <button data-id> sans classe flow-card → exclus) ;
      //  • tarifs/contact = vraies <section id>.
      var SEC_FLOWS = ["city", "alert", "site", "safe", "school", "hotel"];
      var SEC_PAGES = ["tarifs", "contact"];
      if ("IntersectionObserver" in window) {
        var secMap = new Map(); // élément de contenu -> "sec_<clé>"
        document.querySelectorAll(".flow-card[data-id]").forEach(function (el) {
          var id = el.getAttribute("data-id");
          if (SEC_FLOWS.indexOf(id) > -1) secMap.set(el, "sec_" + id);
        });
        SEC_PAGES.forEach(function (id) {
          var el = document.querySelector("section#" + id);
          if (el) secMap.set(el, "sec_" + id);
        });
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            var key = secMap.get(e.target);
            if (e.isIntersecting && key && once(key)) bump(key);
          });
        }, { threshold: 0.4 });
        secMap.forEach(function (key, el) { io.observe(el); });
      }
      document.addEventListener("click", function (ev) {
        var a = ev.target.closest && ev.target.closest('a[href^="mailto:"]'); if (!a) return;
        var h = (a.getAttribute("href") || "").toLowerCase();
        bump((h.indexOf("subject=demande") > -1 || h.indexOf("monstration") > -1) ? "clk_demo" : "clk_contact");
      }, true);
    }).catch(function () { started = false; });
  }

  // ── Décision au chargement (RIEN ne se charge sans « yes ») ─────────────────
  function boot() { var s = status(); if (s === "yes") start(); else if (s === "no") { /* site normal, rien */ } else showBanner(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

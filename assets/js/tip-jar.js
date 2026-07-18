/*
 * Tip Jar — nostalgic animated donate widget for the finance portal.
 * Uses the shared TrollPay library (troll-pay.js) to send a USDC/$TROLL tip
 * straight to the Troll Fund treasury. Each confirmed tip drops a coin in the
 * glass jar (cosmetic, session-only — resets on page refresh).
 */
(function () {
  'use strict';

  var COIN_CAP  = 24;            // max coins drawn in the jar
  var coinCount = 0;             // session-only counter (resets on refresh)
  // On-chain memo tag → the transaction log categorizes this as a tip.
  // Format: TR|<category>|<label>
  var TIP_MEMO  = 'TR|tip|Tip';

  function $(id) { return document.getElementById(id); }
  function getCount() { return coinCount; }
  function setCount(n) { coinCount = Math.min(n, COIN_CAP); }

  function init() {
    var glass   = $('tip-jar-glass');
    var pile    = $('tip-jar-coins');
    var amounts = $('tip-amounts');
    var custom  = $('tip-amt-custom');
    var sendBtn = $('tip-send-btn');
    var statusEl = $('tip-status');
    var netNote = $('tip-net-note');
    if (!sendBtn || !pile || !window.TrollPay) return;

    var selectedUsd = 4.20;
    // USDC is 1:1 so we send exactly the amount; $TROLL is a USD-valued tip
    // converted to tokens at pay time, so we label it "$X in $TROLL".
    function sendLabel() {
      if (window.TrollPay.getToken() === 'TROLL') return 'Tip $' + selectedUsd.toFixed(2) + ' in $TROLL';
      return 'Tip ' + selectedUsd.toFixed(2) + ' USDC';
    }

    window.TrollPay.mountTokenPicker($('tip-token-picker'), function () {
      sendBtn.textContent = sendLabel();
    });
    if (window.TrollPay.config && window.TrollPay.config.DEVNET_MODE && netNote) {
      netNote.textContent = 'Test mode — devnet (fake USDC).';
    }

    // Wallet chip: shows the connected address + what it actually holds, so a
    // visitor can see their $TROLL/USDC before deciding whether/how much to tip.
    var walletBtn = $('tip-wallet-btn');
    var walletBalEl = $('tip-wallet-balances');
    function renderWalletStatus() {
      if (!walletBtn) return;
      var w = window.TrollPay.getWallet();
      if (!w || !w.address) { walletBtn.textContent = '👛 Connect Wallet'; if (walletBalEl) walletBalEl.textContent = ''; return; }
      walletBtn.textContent = '👛 ' + w.address.slice(0, 4) + '…' + w.address.slice(-4);
      if (!walletBalEl || !window.TrollPay.getBalances) return;
      walletBalEl.textContent = 'Loading balances…';
      window.TrollPay.getBalances(w.address).then(function (bal) {
        var parts = [];
        if (bal.troll != null) parts.push(bal.troll.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' $TROLL');
        if (bal.usdc != null) parts.push(bal.usdc.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' USDC');
        walletBalEl.textContent = parts.join(' · ');
      });
    }
    if (walletBtn) {
      walletBtn.addEventListener('click', async function () {
        if (window.TrollPay.isConnected()) return; // already connected — nothing more to do from here
        walletBtn.disabled = true; walletBtn.textContent = 'Connecting…';
        try { await window.TrollPay.connect(); }
        catch (e) { walletBtn.textContent = '👛 Connect Wallet'; if (walletBalEl) walletBalEl.textContent = '⚠ ' + ((e && e.message) || 'Could not connect'); }
        walletBtn.disabled = false;
        renderWalletStatus();
      });
    }
    // If Phantom already trusts this origin (connected here before, or via
    // the main site's header), this resolves silently — no popup either way.
    if (window.TrollPay.warmConnect) void window.TrollPay.warmConnect().then(renderWalletStatus);

    function placeRestingCoin(i) {
      var c = document.createElement('div');
      c.className = 'tip-coin';
      var col = i % 4, row = Math.floor(i / 4);
      var jitter = Math.random() * 8 - 4;
      c.style.left = (8 + col * 31 + jitter) + 'px';
      c.style.bottom = (8 + row * 13) + 'px';
      c.style.transform = 'rotate(' + (Math.random() * 24 - 12) + 'deg)';
      pile.appendChild(c);
    }

    function renderPile() {
      pile.innerHTML = '';
      var n = Math.min(getCount(), COIN_CAP);
      console.log('[tip-jar] renderPile: drawing', n, 'coins');
      for (var i = 0; i < n; i++) placeRestingCoin(i);
    }

    function commitCoin() {           // persist + show one more trollface coin
      var c = getCount() + 1;
      setCount(c);
      if (c <= COIN_CAP) placeRestingCoin(c - 1);
    }

    function dropCoin() {
      glass.classList.remove('is-shook');
      void glass.offsetWidth;            // restart the shake animation
      glass.classList.add('is-shook');

      var d = document.createElement('div');
      d.className = 'tip-coin dropping';
      glass.appendChild(d);
      d.addEventListener('animationend', function () {
        d.remove();
        commitCoin();
      }, { once: true });
    }

    function setSelected(usd, fromCustom) {
      selectedUsd = usd;
      sendBtn.textContent = sendLabel();
      amounts.querySelectorAll('.tip-amt').forEach(function (b) {
        b.classList.toggle('is-active', !fromCustom && parseFloat(b.dataset.usd) === usd);
      });
      if (!fromCustom && custom) custom.value = '';
    }

    amounts.querySelectorAll('.tip-amt').forEach(function (b) {
      b.addEventListener('click', function () { setSelected(parseFloat(b.dataset.usd), false); });
    });
    if (custom) {
      custom.addEventListener('input', function () {
        var v = parseFloat(custom.value);
        if (v > 0) setSelected(Math.round(v * 100) / 100, true);
      });
    }

    sendBtn.addEventListener('click', async function () {
      if (!(selectedUsd > 0)) { statusEl.textContent = 'Enter an amount.'; return; }

      // One extra tap before any wallet interaction — catches misclicks on the
      // amount buttons before real money moves. Phantom's own approval screen
      // still shows after this; that step can't be skipped (nor should it).
      var confirmLabel = window.TrollPay.getToken() === 'TROLL'
        ? '$' + selectedUsd.toFixed(2) + ' in $TROLL' : selectedUsd.toFixed(2) + ' USDC';
      if (!window.confirm('Send ' + confirmLabel + ' to the Troll Fund treasury?\n\nThis is a real crypto payment.')) return;

      // Phone with no injected wallet → hand off to the Phantom app via Solana Pay.
      // Don't commit the coin until the user returns; the transaction log will catch it.
      if (window.TrollPay.shouldUseSolanaPay && window.TrollPay.shouldUseSolanaPay()) {
        statusEl.textContent = 'Opening Phantom…';
        try {
          var payUrl = await window.TrollPay.solanaPayUrl({
            amountUsd: selectedUsd, token: window.TrollPay.getToken(),
            label: 'Troll Fund tip', message: 'Tip the Troll Runner', memo: TIP_MEMO,
          });
          window.location.href = payUrl;   // launches the Phantom app to approve
        } catch (e) {
          statusEl.textContent = '⚠ ' + ((e && e.message) || 'Could not open Phantom');
        }
        return;
      }

      sendBtn.disabled = true;
      var orig = sendLabel();
      statusEl.textContent = '';
      sendBtn.textContent = 'Connect wallet…';

      var res = await window.TrollPay.pay({
        amountUsd: selectedUsd,
        token: window.TrollPay.getToken(),
        taxRate: 0,                       // tips are straight donations, no tax
        memo: TIP_MEMO,                   // on-chain tag → categorized as a tip
        onProgress: function (ev) {
          if (ev.stage === 'connecting')      sendBtn.textContent = 'Connect wallet…';
          else if (ev.stage === 'building')   sendBtn.textContent = 'Building tx…';
          else if (ev.stage === 'awaiting')   sendBtn.textContent = 'Confirm in Phantom…';
          else if (ev.stage === 'confirming') { sendBtn.textContent = 'Confirming…'; statusEl.textContent = 'Sent — confirming on-chain…'; }
        },
      });

      sendBtn.disabled = false;
      sendBtn.textContent = orig;
      renderWalletStatus(); // pay() connects the wallet if it wasn't already — reflect that + the new balance
      if (!res.ok) { statusEl.textContent = '⚠ ' + res.reason; return; }
      dropCoin();
      var url = window.TrollPay.explorerUrl(res.txSig);
      statusEl.innerHTML = '🪙 Thanks for the tip! <a href="' + url + '" target="_blank" rel="noopener">View receipt ↗</a>';
    });

    setSelected(selectedUsd, false);
    renderPile();
    renderWalletStatus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

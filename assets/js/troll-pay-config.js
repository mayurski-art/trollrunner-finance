/*
 * TROLL_PAY_CONFIG for the finance tip jar.
 * Canonical reference + template lives at trollrunner.net/assets/js/.
 * Load BEFORE troll-pay.js and tip-jar.js.
 */
(function () {
  'use strict';

  // true  = devnet (fake money, safe for testing)
  // false = mainnet (real money — flip before going live)
  var DEVNET = true;

  window.TROLL_PAY_CONFIG = {

    DEVNET_MODE: DEVNET,

    SOLANA_NETWORK:  DEVNET ? 'devnet' : 'mainnet-beta',
    SOLANA_RPC:      DEVNET ? 'https://api.devnet.solana.com'
                            : 'https://api.mainnet-beta.solana.com',
    EXPLORER_BASE:   'https://solscan.io/tx/',
    EXPLORER_SUFFIX: DEVNET ? '?cluster=devnet' : '',

    // The Troll Fund wallet — every tip lands here. Single transfer, no splits.
    TREASURY_WALLET: '79vVRZ7qnZfj9xCto5d9Kwf4eAimqMDrQysZjHBbFbsA',

    // Devnet USDC (Circle). Mainnet USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    USDC_MINT:     DEVNET ? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
                          : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDC_DECIMALS: 6,
    // $TROLL has no devnet equivalent — hidden until set + on mainnet.
    TROLL_MINT:     'FILL_ME_IN',
    TROLL_DECIMALS: 9,

    PRICE_FEED_URL: 'https://api.jup.ag/price/v2?ids=',

    // Tips are straight donations (no added tax). These are unused by the tip
    // jar but kept for parity with the shared library's payForRevive helper.
    REVIVE_PRICE_USD: 0.69,
    TAX_RATE:         0.069,
  };
})();

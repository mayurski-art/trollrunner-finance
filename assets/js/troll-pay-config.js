/*
 * TROLL_PAY_CONFIG for the finance tip jar.
 * Canonical reference + template lives at trollrunner.net/assets/js/.
 * Load BEFORE the cross-origin troll-pay.js and tip-jar.js.
 */
(function () {
  'use strict';

  // true  = devnet (fake money — but $TROLL doesn't exist there, and the
  //         public devnet RPC is unreliable for confirmation).
  // false = mainnet (real money + real $TROLL). This is the live mode.
  var DEVNET = false;

  window.TROLL_PAY_CONFIG = {

    DEVNET_MODE: DEVNET,

    SOLANA_NETWORK:  DEVNET ? 'devnet' : 'mainnet-beta',
    // NOTE: api.mainnet-beta.solana.com now returns 403 to browser apps, so we
    // use PublicNode's free, no-key, CORS-enabled endpoint for mainnet. For
    // higher reliability later, drop in a Helius/QuickNode URL here.
    SOLANA_RPC:      DEVNET ? 'https://api.devnet.solana.com'
                            : 'https://solana-rpc.publicnode.com',
    EXPLORER_BASE:   'https://solscan.io/tx/',
    EXPLORER_SUFFIX: DEVNET ? '?cluster=devnet' : '',

    // The Troll Fund wallet — every tip lands here. Single transfer, no splits.
    TREASURY_WALLET: '79vVRZ7qnZfj9xCto5d9Kwf4eAimqMDrQysZjHBbFbsA',

    // Devnet USDC (Circle). Mainnet USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    USDC_MINT:     DEVNET ? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
                          : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDC_DECIMALS: 6,
    // $TROLL — Solana mainnet. Mint has 6 decimals (verified on-chain).
    // Only used on mainnet (no devnet equivalent exists).
    TROLL_MINT:     '5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2',
    TROLL_DECIMALS: 6,

    // Jupiter Price API v3 (free lite tier). Response shape:
    //   { "<mint>": { "usdPrice": 0.057, "decimals": 6, ... } }
    PRICE_FEED_URL: 'https://lite-api.jup.ag/price/v3?ids=',

    // Tips are straight donations (no added tax). Unused by the tip jar but
    // kept for parity with the shared library's payForRevive helper.
    REVIVE_PRICE_USD: 0.69,
    TAX_RATE:         0.069,
  };
})();

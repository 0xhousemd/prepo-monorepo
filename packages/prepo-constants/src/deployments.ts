export const DEPLOYMENT_NAMES = {
  ppo: {
    name: 'PPO',
    restrictedTransferHook: {
      name: 'PPO-RestrictedTransferHook',
      blocklist: {
        name: 'PPO-RestrictedTransferHook-Blocklist',
      },
      sourceAllowlist: {
        name: 'PPO-RestrictedTransferHook-SourceAllowlist',
      },
      destinationAllowlist: {
        name: 'PPO-RestrictedTransferHook-DestinationAllowlist',
      },
    },
  },
  miniSales_permissioned: {
    name: 'MiniSales_Permissioned',
    allowlistPurchaseHook: {
      name: 'MiniSales_Permissioned-AllowlistPurchaseHook',
      allowlist: {
        name: 'MiniSales_Permissioned-AllowlistPurchaseHook-Allowlist',
      },
    },
  },
  miniSales_public: {
    name: 'MiniSales_Public',
  },
  vesting: {
    name: 'Vesting',
  },
  miniSalesFlag: {
    name: 'MiniSalesFlag',
  },
  preUSDC: {
    name: 'preUSDC',
    depositHook: {
      name: 'preUSDC-DepositHook',
      depositRecord: {
        name: 'preUSDC-DepositRecord',
      },
      tokenSender: {
        name: 'PPOTokenSender',
      },
    },
    managerWithdrawHook: {
      name: 'preUSDC-ManagerWithdrawHook',
      depositRecord: {
        name: 'preUSDC-DepositRecord',
      },
    },
    withdrawHook: {
      name: 'preUSDC-WithdrawHook',
      depositRecord: {
        name: 'preUSDC-DepositRecord',
      },
      tokenSender: {
        name: 'PPOTokenSender',
      },
    },
    depositRecord: {
      name: 'preUSDC-DepositRecord',
      allowedMsgSenders: {
        name: 'preUSDC-DepositRecord-AllowedMsgSenders',
      },
    },
  },
  tokenSender: {
    name: 'PPOTokenSender',
    allowedMsgSenders: {
      name: 'PPOTokenSender-AllowedMsgSenders',
    },
    fixedPrice: {
      name: 'PPOTokenSender-FixedPrice',
    },
  },
  depositTradeHelper: {
    name: 'DepositTradeHelper',
  },
  arbitrageBroker: {
    name: 'ArbitrageBroker',
  },
  prePOMarketFactory: {
    name: 'PrePOMarketFactory',
  },
} as const

export type DeploymentNames = typeof DEPLOYMENT_NAMES

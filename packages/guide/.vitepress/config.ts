import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'MSQPay',
  description: 'MSQPay Documentation - Blockchain Payment Gateway',

  locales: {
    ko: {
      label: '한국어',
      lang: 'ko',
      link: '/ko/',
      themeConfig: {
        nav: [
          { text: '시작하기', link: '/ko/getting-started/' },
          { text: 'SDK', link: '/ko/sdk/' },
          { text: '결제', link: '/ko/payments/create' },
          { text: 'Gasless', link: '/ko/gasless/' },
          { text: 'Webhook', link: '/ko/webhook/' },
          { text: 'API Reference', link: '/ko/api/' },
        ],
        sidebar: {
          '/ko/getting-started/': [
            {
              text: '시작하기',
              items: [
                { text: '개요', link: '/ko/getting-started/' },
                { text: '빠른 시작', link: '/ko/getting-started/quick-start' },
                { text: '인증', link: '/ko/getting-started/authentication' },
              ],
            },
          ],
          '/ko/sdk/': [
            {
              text: 'SDK',
              items: [
                { text: '설치', link: '/ko/sdk/' },
                { text: '클라이언트 메서드', link: '/ko/sdk/client' },
              ],
            },
          ],
          '/ko/payments/': [
            {
              text: '결제',
              items: [
                { text: '결제 생성', link: '/ko/payments/create' },
                { text: '상태 조회', link: '/ko/payments/status' },
                { text: '결제 내역', link: '/ko/payments/history' },
              ],
            },
          ],
          '/ko/gasless/': [
            {
              text: 'Gasless 결제',
              items: [
                { text: '개요', link: '/ko/gasless/' },
                { text: '구현 방법', link: '/ko/gasless/implementation' },
              ],
            },
          ],
          '/ko/webhook/': [
            {
              text: 'Webhook',
              items: [
                { text: '설정', link: '/ko/webhook/' },
                { text: '서명 검증', link: '/ko/webhook/verify' },
                { text: '이벤트 상세', link: '/ko/webhook/events' },
              ],
            },
          ],
          '/ko/api/': [
            {
              text: 'API Reference',
              items: [
                { text: '전체 명세', link: '/ko/api/' },
                { text: '에러 코드', link: '/ko/api/errors' },
              ],
            },
          ],
        },
        outline: {
          level: [2, 3],
          label: '이 페이지',
        },
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Getting Started', link: '/en/getting-started/' },
          { text: 'SDK', link: '/en/sdk/' },
          { text: 'Payments', link: '/en/payments/create' },
          { text: 'Gasless', link: '/en/gasless/' },
          { text: 'Webhook', link: '/en/webhook/' },
          { text: 'API Reference', link: '/en/api/' },
        ],
        sidebar: {
          '/en/getting-started/': [
            {
              text: 'Getting Started',
              items: [
                { text: 'Overview', link: '/en/getting-started/' },
                { text: 'Quick Start', link: '/en/getting-started/quick-start' },
                { text: 'Authentication', link: '/en/getting-started/authentication' },
              ],
            },
          ],
          '/en/sdk/': [
            {
              text: 'SDK',
              items: [
                { text: 'Installation', link: '/en/sdk/' },
                { text: 'Client Methods', link: '/en/sdk/client' },
              ],
            },
          ],
          '/en/payments/': [
            {
              text: 'Payments',
              items: [
                { text: 'Create Payment', link: '/en/payments/create' },
                { text: 'Check Status', link: '/en/payments/status' },
                { text: 'Payment History', link: '/en/payments/history' },
              ],
            },
          ],
          '/en/gasless/': [
            {
              text: 'Gasless Payments',
              items: [
                { text: 'Overview', link: '/en/gasless/' },
                { text: 'Implementation', link: '/en/gasless/implementation' },
              ],
            },
          ],
          '/en/webhook/': [
            {
              text: 'Webhook',
              items: [
                { text: 'Setup', link: '/en/webhook/' },
                { text: 'Signature Verification', link: '/en/webhook/verify' },
                { text: 'Event Details', link: '/en/webhook/events' },
              ],
            },
          ],
          '/en/api/': [
            {
              text: 'API Reference',
              items: [
                { text: 'Full Specification', link: '/en/api/' },
                { text: 'Error Codes', link: '/en/api/errors' },
              ],
            },
          ],
        },
        outline: {
          level: [2, 3],
          label: 'On this page',
        },
      },
    },
  },

  themeConfig: {
    socialLinks: [{ icon: 'github', link: 'https://github.com/globalmsq/msqpay-monorepo' }],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'MSQPay Documentation',
      copyright: 'Copyright © 2026 MSQPay',
    },

    darkModeSwitchLabel: '',
    darkModeSwitchTitle: '',
  },
});

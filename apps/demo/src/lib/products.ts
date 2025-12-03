/**
 * Product definitions - Server-side source of truth for product info
 *
 * 설계 원칙:
 * - 상품은 가격(price)만 포함 - 체인/토큰 정보는 상점 설정에서 관리
 * - price는 상점의 결제 토큰 단위 (예: "10" = 10 TEST 토큰)
 * - 체인/토큰 설정은 merchant.ts에서 통합 관리
 *
 * ⚠️ SECURITY: 가격은 반드시 서버 측에서 조회
 * 클라이언트가 제공한 금액은 절대 신뢰하지 않음
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  /** 상점 토큰 단위 가격 (예: "10" = 10 TEST) */
  price: string;
  image?: string;
}

/**
 * 상품 카탈로그
 *
 * 사용처:
 * - 프론트엔드: 표시용 (name, description, image, price)
 * - 백엔드 API: 가격 조회 (id → price)
 */
export const PRODUCTS: Product[] = [
  {
    id: 'product-1',
    name: 'Digital Art Pack',
    description: 'Collection of 10 unique digital artworks',
    price: '10',
    image: '/images/art.png',
  },
  {
    id: 'product-2',
    name: 'Premium Membership',
    description: '1 month access to premium features',
    price: '50',
    image: '/images/membership.png',
  },
  {
    id: 'product-3',
    name: 'Game Credits',
    description: '1000 in-game credits for your account',
    price: '25',
    image: '/images/credits.png',
  },
  {
    id: 'product-4',
    name: 'NFT Mint Pass',
    description: 'Whitelist access to upcoming NFT drop',
    price: '100',
    image: '/images/nft.png',
  },
];

/**
 * ID로 상품 조회
 * @param productId 상품 ID
 * @returns Product 또는 undefined
 */
export function getProductById(productId: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === productId);
}

/**
 * 상품 가격 조회 - 서버 측 가격 검증용
 * @param productId 상품 ID
 * @returns 가격 문자열 또는 null
 */
export function getProductPrice(productId: string): string | null {
  const product = getProductById(productId);
  return product?.price ?? null;
}

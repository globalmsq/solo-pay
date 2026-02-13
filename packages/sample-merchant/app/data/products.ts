export interface Product {
  id: number;
  name: string;
  roast: string;
  weight: string;
  price: number;
  description: string;
}

export const products: Product[] = [
  {
    id: 1,
    name: 'Ethiopia Yirgacheffe',
    roast: 'Light Roast',
    weight: '250g',
    price: 25.0,
    description: 'Bright citrus and floral jasmine with a clean, tea-like finish.',
  },
  {
    id: 2,
    name: 'Colombia Supremo',
    roast: 'Medium Roast',
    weight: '250g',
    price: 22.0,
    description: 'Rich caramel sweetness with nutty undertones and a smooth body.',
  },
  {
    id: 3,
    name: 'Guatemala Antigua',
    roast: 'Medium-Dark Roast',
    weight: '250g',
    price: 28.0,
    description: 'Deep chocolate and spice complexity with a velvety mouthfeel.',
  },
  {
    id: 4,
    name: 'Kenya AA',
    roast: 'Light-Medium Roast',
    weight: '250g',
    price: 30.0,
    description: 'Bold blackcurrant and grapefruit acidity with a winey depth.',
  },
  {
    id: 5,
    name: 'Brazil Santos',
    roast: 'Dark Roast',
    weight: '250g',
    price: 19.0,
    description: 'Low acidity with bittersweet cocoa and roasted almond notes.',
  },
  {
    id: 6,
    name: 'Sumatra Mandheling',
    roast: 'Dark Roast',
    weight: '250g',
    price: 26.0,
    description: 'Earthy and full-bodied with cedar and dark chocolate undertones.',
  },
];

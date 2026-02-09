export interface Product {
  id: string;
  name: string;
  roast: string;
  weight: string;
  price: number;
  description: string;
}

export const products: Product[] = [
  {
    id: "ethiopia-yirgacheffe",
    name: "Ethiopia Yirgacheffe",
    roast: "Light Roast",
    weight: "250g",
    price: 25.0,
    description:
      "Bright citrus and floral jasmine with a clean, tea-like finish.",
  },
  {
    id: "colombia-supremo",
    name: "Colombia Supremo",
    roast: "Medium Roast",
    weight: "250g",
    price: 22.0,
    description:
      "Rich caramel sweetness with nutty undertones and a smooth body.",
  },
  {
    id: "guatemala-antigua",
    name: "Guatemala Antigua",
    roast: "Medium-Dark Roast",
    weight: "250g",
    price: 28.0,
    description:
      "Deep chocolate and spice complexity with a velvety mouthfeel.",
  },
  {
    id: "kenya-aa",
    name: "Kenya AA",
    roast: "Light-Medium Roast",
    weight: "250g",
    price: 30.0,
    description:
      "Bold blackcurrant and grapefruit acidity with a winey depth.",
  },
  {
    id: "brazil-santos",
    name: "Brazil Santos",
    roast: "Dark Roast",
    weight: "250g",
    price: 19.0,
    description:
      "Low acidity with bittersweet cocoa and roasted almond notes.",
  },
  {
    id: "sumatra-mandheling",
    name: "Sumatra Mandheling",
    roast: "Dark Roast",
    weight: "250g",
    price: 26.0,
    description:
      "Earthy and full-bodied with cedar and dark chocolate undertones.",
  },
];

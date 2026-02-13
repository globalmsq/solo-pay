import { PrismaClient } from '../app/generated/prisma/client';

const prisma = new PrismaClient();

const products = [
  {
    id: 1,
    name: 'Ethiopia Yirgacheffe',
    roast: 'Light Roast',
    weight: '250g',
    price: 25,
    description: 'Bright citrus and floral jasmine with a clean, tea-like finish.',
    image_url: '/images/ethiopia-yirgacheffe.svg',
  },
  {
    id: 2,
    name: 'Colombia Supremo',
    roast: 'Medium Roast',
    weight: '250g',
    price: 22,
    description: 'Rich caramel sweetness with nutty undertones and a smooth body.',
    image_url: '/images/colombia-supremo.svg',
  },
  {
    id: 3,
    name: 'Guatemala Antigua',
    roast: 'Medium-Dark Roast',
    weight: '250g',
    price: 28,
    description: 'Deep chocolate and spice complexity with a velvety mouthfeel.',
    image_url: '/images/guatemala-antigua.svg',
  },
  {
    id: 4,
    name: 'Kenya AA',
    roast: 'Light-Medium Roast',
    weight: '250g',
    price: 30,
    description: 'Bold blackcurrant and grapefruit acidity with a winey depth.',
    image_url: '/images/kenya-aa.svg',
  },
  {
    id: 5,
    name: 'Brazil Santos',
    roast: 'Dark Roast',
    weight: '250g',
    price: 19,
    description: 'Low acidity with bittersweet cocoa and roasted almond notes.',
    image_url: '/images/brazil-santos.svg',
  },
  {
    id: 6,
    name: 'Sumatra Mandheling',
    roast: 'Dark Roast',
    weight: '250g',
    price: 26,
    description: 'Earthy and full-bodied with cedar and dark chocolate undertones.',
    image_url: '/images/sumatra-mandheling.svg',
  },
];

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        roast: product.roast,
        weight: product.weight,
        price: product.price,
        description: product.description,
        image_url: product.image_url,
      },
      create: product,
    });
  }
  console.log(`Seeded ${products.length} products`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

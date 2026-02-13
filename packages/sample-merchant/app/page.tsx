import ProductCard from './components/ProductCard';
import { products } from './data/products';

export default function Home() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="w-full border-b border-border px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-text-primary text-lg font-semibold tracking-[0.2em] uppercase">
            Solo Roasters
          </h1>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-6xl w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>
    </div>
  );
}

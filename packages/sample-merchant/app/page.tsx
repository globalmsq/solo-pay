import ProductCard from './components/ProductCard';
import { products } from './data/products';

export default function Home() {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-5 md:px-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-playfair text-text-primary text-lg font-semibold tracking-[0.15em] uppercase">
            Solo Roasters
          </h1>
        </div>
        <div className="max-w-5xl mx-auto mt-3 h-px bg-accent-gold/30" />
      </header>

      {/* Hero */}
      <section className="w-full px-6 py-16 md:px-12">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-playfair text-4xl md:text-5xl font-semibold text-text-primary mb-4">
            Solo Roasters
          </h2>
          <p className="text-text-secondary text-base md:text-lg max-w-md mx-auto mb-8">
            Exceptional single-origin coffees, thoughtfully roasted
          </p>
          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-px bg-accent-gold/40" />
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <rect
                x="3"
                y="3"
                width="6"
                height="6"
                transform="rotate(45 6 6)"
                fill="#C5A572"
                opacity="0.6"
              />
            </svg>
            <div className="w-12 h-px bg-accent-gold/40" />
          </div>
        </div>
      </section>

      {/* Collection */}
      <main className="flex-1 px-6 py-5 md:px-12">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <span className="text-accent-gold text-xs font-medium tracking-[0.2em] uppercase">
              Our Collection
            </span>
            <div className="w-12 h-px bg-accent-gold/40 mx-auto mt-3" />
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 md:px-12 pt-12 pb-8">
        <div className="max-w-5xl mx-auto border-t border-border pt-8 text-center">
          <p className="font-playfair text-text-muted text-sm tracking-[0.15em] uppercase">
            Solo Roasters
          </p>
          <p className="text-text-muted text-xs mt-2">Crafted with care</p>
        </div>
      </footer>
    </div>
  );
}

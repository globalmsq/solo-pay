import { Product } from '../data/products';

export default function ProductCard({ product }: { product: Product }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 flex flex-col">
      {/* Product Image */}
      <div className="aspect-4/3 w-full rounded-xl bg-surface-card flex items-center justify-center mb-5 overflow-hidden">
        <div className="text-center">
          <div className="text-5xl mb-2 grayscale opacity-80">&#9749;</div>
          <p className="text-text-muted text-xs tracking-widest uppercase">{product.roast}</p>
        </div>
      </div>

      {/* Product Info */}
      <div className="flex-1 space-y-3 mb-2">
        <div>
          <h2 className="text-text-primary text-lg font-medium">{product.name}</h2>
          <p className="text-text-secondary text-sm mt-1">
            {product.roast} &middot; {product.weight}
          </p>
        </div>
        <p className="text-text-muted text-sm leading-relaxed">{product.description}</p>
      </div>

      {/* Price + Pay Button */}
      <div className="flex items-center justify-between mt-auto">
        <p className="text-text-primary text-lg font-semibold">${product.price}</p>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold text-xs transition-colors cursor-pointer"
        >
          Pay Now
        </button>
      </div>
    </div>
  );
}

import { MobileHeader } from '../components/Layout';
import { UnitCard } from '../components/UnitCard';
import { UNITS } from '../data';

export function UnitsPage() {
  return (
    <>
      <MobileHeader title="14 unit" />
      <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
        <h1 className="mb-4 hidden text-2xl text-slate-900 md:block">14 unit</h1>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {UNITS.map((u) => (
            <UnitCard key={u.id} unit={u} />
          ))}
        </div>
      </main>
    </>
  );
}

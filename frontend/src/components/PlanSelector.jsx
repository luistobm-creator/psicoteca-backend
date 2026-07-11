// Selector de plan Pro (mensual / anual) para el flujo de Checkout.
//
// Envía el `id` elegido ('annual' | 'monthly') a startProCheckout(interval); el
// backend lo traduce al Price de Stripe correspondiente. Los PRECIOS mostrados
// aquí son solo informativos (marketing): el importe real lo define el Price en
// Stripe. Si cambian los Price, actualiza también backend/app/config.py.
const PLANS = [
  {
    id: 'annual',
    name: 'Anual',
    price: '$199',
    unit: 'MXN/año',
    note: '≈ $17/mes · ahorra ~57%',
    badge: 'Mejor precio',
  },
  {
    id: 'monthly',
    name: 'Mensual',
    price: '$39',
    unit: 'MXN/mes',
    note: 'Se factura cada mes',
    badge: null,
  },
];

export default function PlanSelector({ value, onChange }) {
  return (
    <div className="plansel" role="radiogroup" aria-label="Elige tu plan Pro">
      {PLANS.map((plan) => {
        const selected = value === plan.id;
        return (
          <button
            type="button"
            key={plan.id}
            className={'plansel__opt' + (selected ? ' is-selected' : '')}
            onClick={() => onChange(plan.id)}
            role="radio"
            aria-checked={selected}
          >
            <span className="plansel__radio" aria-hidden="true" />
            <span className="plansel__body">
              <span className="plansel__top">
                <span className="plansel__name">{plan.name}</span>
                {plan.badge && <span className="plansel__badge">{plan.badge}</span>}
              </span>
              <span className="plansel__note">{plan.note}</span>
            </span>
            <span className="plansel__price">
              {plan.price}
              <span className="plansel__unit">{plan.unit}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

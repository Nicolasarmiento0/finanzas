// Formateador de Peso Chileno (CLP - Enteros sin decimales)

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export function formatCLP(amount: number): string {
  return clpFormatter.format(Math.round(amount));
}

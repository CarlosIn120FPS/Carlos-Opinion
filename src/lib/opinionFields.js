// Los tres modales mostraban la misma lógica "¿tengo una nota, dos, o ninguna?"
// copiada seis veces (rating y opinión × tres modales). Cada copia podía
// desincronizarse — y de hecho una lo estaba. Aquí vive la decisión una sola vez;
// cada modal se queda con su propio aspecto y solo recorre el resultado.
function tristate(during, final, labels) {
  if (during && final) {
    return [
      { key: 'during', label: labels.during, value: during },
      { key: 'final', label: labels.final, value: final },
    ];
  }
  if (final) return [{ key: 'final', label: labels.single, value: final }];
  if (during) return [{ key: 'during', label: labels.during, value: during }];
  return [];
}

export const ratingEntries = (item, labels) => tristate(item.rating, item.ratingFinal, labels);

export const opinionEntries = (item, labels) =>
  tristate(item.personalOpinion, item.personalOpinionFinal, labels);

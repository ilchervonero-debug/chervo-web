---
name: emplacado-ux-v2
description: Rediseño UX pendiente de EMPLACADO — selector por componentes en lugar de tarjetas de tipo
metadata: 
  node_type: memory
  type: project
  originSessionId: e9cda062-5b95-465a-84c3-77db1ba65659
---

# EMPLACADO v2 — UX por componentes

**Why:** el usuario rechazó el selector de tarjetas (M04, M05…) porque requiere conocer los códigos. Quiere que el usuario describa el muro seleccionando sus partes, y el sistema resuelva la combinación.

**How to apply:** cuando se retome EMPLACADO, reescribir la sección Muros con este enfoque. El archivo está en `apps/ilyorugua/emp/index.html`.

---

## Nueva UX — Muros

En lugar de 11 botones de tipo, el usuario configura el muro con dropdowns:

| Campo | Opciones |
|---|---|
| Perfil | PGC 35mm / PGC 70mm / PGC 100mm |
| Estructura | Simple / Doble |
| Cara A — capas | 1 capa / 2 capas |
| Cara A — placa | Yeso STD / Yeso RH / RF / OSB / Cementicia |
| Cara B — capas | 1 capa / 2 capas / Ninguna (contra-pared) |
| Cara B — placa | Yeso STD / Yeso RH / RF / OSB / Cementicia |
| Aislante | Ninguno / Lana de vidrio |

El sistema **reconoce** la combinación y la mapea al tipo APU más cercano (informativo). Si no hay match, calcula paramétrico.

---

## Motor de cálculo paramétrico

Coeficientes por componente (en lugar de matriz por tipo):

```js
const PROFILE_COEF = {
  '35':  { pgc: 0.4502, pgu: 0.0726 },  // barras/m²
  '70':  { pgc: 0.4500, pgu: 0.0724 },
  '100': { pgc: 0.4501, pgu: 0.0725 },
};
// Doble estructura: × 2

const PLACA_NET = 1 / 2.88;  // 0.347 placas/m² por capa (waste aparte)

// Terminación — por capa expuesta de yeso (STD / RH)
const FINISH_PER_LAYER = {
  MASILLA: 0.511,   // kg/m² de muro
  ENDUIDO: 0.511,
  PINTURA: 1.023,   // m² cobertura / m² muro
  CINTA_P: 0.031,   // ml/m² (por cara, no por capa)
  TORN_S:  0.067,   // cajas·100u / m²
};
// OSB / CEM / RF → sin terminación húmeda (solo tornillos)
```

## Mapeo combinación → APU

| Perfil | Cara A | Cara B | Aislante | Tipo APU |
|---|---|---|---|---|
| 35 | 1×STD | 1×STD | no | M08 |
| 70 | 1×STD | 1×STD | no | M70 |
| 70 | 1×OSB | 1×OSB | no | M06 |
| 70 | 1×STD | 1×STD (doble) | no | M10 |
| 70 | 2×OSB | 2×OSB | no | M11 |
| 100 | 2×STD | 1×STD | no | M04 |
| 100 | 2×STD | 1×RH | no | M05 |
| 100 | 1×RF | 1×CEM | no | M07 |
| 100 | 2×OSB | 2×OSB | no | M14 |
| 35 | 1×OSB | — | no | M12 |
| Omega | 1×STD | — | no | MCW |

Si no hay match exacto → "configuración personalizada" y usa fórmula paramétrica.

## Nueva UX — Cielorrasos

Igual de simple:

| Campo | Opciones |
|---|---|
| Sistema | Drywall / PVC panel / Fibrocemento |
| Placa | (según sistema) STD / RH / PVC / FC |
| Grilla | 0.61m (estándar) / 0.40m (reforzado) |
| Terminación | Ninguna / Ángulo L perimetral |

Estructura (Omega + Hat) calculada geométricamente desde L × W + spacing.

---

## Estado actual

- `apps/ilyorugua/emp/index.html` tiene la v1 con tarjetas — **funciona** pero UX rechazada
- La v2 no requiere cambios de backend ni CORE, solo reemplazar el selector por los dropdowns y conectar al motor paramétrico
- El PRO mode puede quedarse igual o simplificarse a solo waste% y pack sizes

# 🤖 Guía para IA: Fixture Creator 2

## 📋 Índice
1. [Arquitectura del Proyecto](#arquitectura-del-proyecto)
2. [Estructura de Archivos Críticos](#estructura-de-archivos-críticos)
3. [Flujo de Datos](#flujo-de-datos)
4. [Reglas de Edición](#reglas-de-edición)
5. [Problemas Comunes y Soluciones](#problemas-comunes-y-soluciones)
6. [Checklist de Verificación](#checklist-de-verificación)

---

## 🏗️ Arquitectura del Proyecto

### Stack Tecnológico
- **Framework**: Next.js 15.2.4 (App Router)
- **Lenguaje**: TypeScript
- **UI**: React + Tailwind CSS + shadcn/ui
- **Exportación**: html2canvas + JSZip
- **Estado**: React Context API (parcialmente implementado)

### ⚠️ IMPORTANTE: Arquitectura Dual
Este proyecto tiene **DOS sistemas de estado paralelos**:

1. **`app/page.tsx`** (Sistema Principal - ACTIVO)
   - Contiene TODOS los estados reales de la aplicación
   - Renderiza directamente los fixtures (NO usa componentes separados)
   - Es el único archivo que controla la UI visible

2. **`context/AppContext.tsx`** (Sistema Legacy - PARCIALMENTE USADO)
   - Tiene estados duplicados pero NO sincronizados
   - Solo algunos componentes lo usan
   - **NO MODIFICAR** sin sincronizar con `page.tsx`

---

## 📁 Estructura de Archivos Críticos

### 🔴 Archivos de Alta Prioridad (Modificar con cuidado)

#### `/app/page.tsx` (3800+ líneas)
**Propósito**: Componente principal que contiene TODA la lógica de la aplicación.

**Contiene**:
- ~100 estados locales (fixtures, teams, leagues, configuraciones)
- Renderizado directo de fixtures en 3 modos: Normal, Compacto, 2 Columnas
- Lógica de exportación a imágenes
- Tabs: Importar, Fixtures, Equipos, Ligas, Configuración

**Secciones Críticas**:
```typescript
// Línea ~129: Declaración del componente Home()
export default function Home() {

// Líneas ~130-280: Declaración de TODOS los estados
const [fixtures, setFixtures] = useState<Match[]>([])
const [leagues, setLeagues] = useState<League[]>([...])
// ... ~100 estados más

// Líneas ~1757-1860: Renderizado de fixtures (Modo Normal/Compacto)
{fixturesForDate.map((fixture, index) => {
  // Aquí se aplican estilos, gradientes, dimensiones
  
// Líneas ~1694-1850: Renderizado de fixtures (Modo 2 Columnas)
{fixturesForDate.map((fixture, index) => {
  // Renderizado diferente para modo 2 columnas
```

**Reglas de Edición**:
1. ✅ Siempre verificar que los cambios se apliquen a AMBOS modos (Normal/Compacto Y 2 Columnas)
2. ✅ Buscar `backgroundColor` o `background` para aplicar gradientes
3. ✅ Buscar `leagues.find` para entender cómo se obtienen colores/gradientes
4. ❌ NO eliminar estados sin verificar dependencias
5. ❌ NO asumir que componentes en `/components` se usan automáticamente

#### `/types/index.ts`
**Propósito**: Definiciones de tipos TypeScript.

**Tipos Principales**:
```typescript
interface Team {
  id: string
  name: string
  logo: string
  league?: string
}

interface Match {
  id: string
  date: string
  time: string
  homeTeam: Team
  awayTeam: Team
  times: { ARG: string; BOL: string; ECU: string; CHI: string }
  league: string
  leagueColor?: string
  textColor?: string
}

interface League {
  name: string
  color: string
  gradient?: {
    enabled: boolean
    startColor: string
    endColor: string
    direction: "to right" | "to left" | "to top" | "to bottom"
  }
}
```

**Reglas**:
1. ✅ Siempre actualizar tipos cuando agregues propiedades
2. ✅ Usar `?` para propiedades opcionales
3. ❌ NO cambiar tipos existentes sin verificar todos los usos

---

## 🔄 Flujo de Datos

### Estado de Ligas con Gradientes

```
Usuario activa gradiente en tab "Ligas"
    ↓
setLeagues() actualiza el estado en page.tsx
    ↓
leagues[].gradient.enabled = true
    ↓
Renderizado de fixtures busca: leagues.find(l => l.name === fixture.league)
    ↓
Si league.gradient?.enabled === true:
    → Aplica: background: linear-gradient(...)
Sino:
    → Aplica: backgroundColor: league.color
```

### Exportación de Imágenes

```
Usuario hace clic en "Exportar"
    ↓
setExportMode(true) → Oculta controles de edición
    ↓
html2canvas captura cada fixture individual
    ↓
JSZip agrupa todas las imágenes
    ↓
Descarga archivo .zip
```

---

## 📏 Reglas de Edición

### ✅ Reglas Obligatorias

1. **Cambios en Estilos de Fixtures**
   ```typescript
   // ❌ MAL: Solo cambiar en un lugar
   style={{ backgroundColor: league.color }}
   
   // ✅ BIEN: Buscar TODOS los lugares donde se renderiza
   // Buscar: "backgroundColor.*league" o "background.*league"
   // Aplicar en: Modo Normal (línea ~1930), Modo 2 Columnas (línea ~1795)
   ```

2. **Agregar Nuevas Propiedades a League**
   ```typescript
   // Paso 1: Actualizar interface en types/index.ts
   interface League {
     name: string
     color: string
     newProperty?: string  // ← Agregar aquí
   }
   
   // Paso 2: Actualizar predefinedLeagues en page.tsx (línea ~210)
   const predefinedLeagues: League[] = [
     { name: "Euroliga", color: "#EB5B27", newProperty: "value" },
   ]
   
   // Paso 3: Usar en renderizado de fixtures (líneas ~1930 y ~1795)
   ```

3. **Agregar Nuevos Estados**
   ```typescript
   // Declarar cerca de estados relacionados (líneas 130-280)
   const [newState, setNewState] = useState<Type>(defaultValue)
   const [newStateInput, setNewStateInput] = useState<Type>(defaultValue)
   
   // Si es para exportación, agregarlo también en:
   // - exportAllData() (línea ~1250)
   // - importAllData() (línea ~1150)
   // - clearAllSavedData() (línea ~1298)
   ```

### ❌ Errores Comunes a Evitar

1. **Modificar solo `context/AppContext.tsx`**
   - ❌ Los cambios NO se reflejarán en la UI
   - ✅ Modificar `app/page.tsx` directamente

2. **Crear componentes nuevos sin integrarlos**
   - ❌ Crear `NewTab.tsx` y esperar que funcione
   - ✅ Integrar directamente en `page.tsx` o verificar que se importe

3. **Olvidar el modo 2 columnas**
   - ❌ Solo modificar el renderizado del modo Normal/Compacto
   - ✅ Buscar y modificar AMBOS lugares de renderizado

4. **No cerrar etiquetas JSX correctamente**
   - ❌ Agregar `<div>` sin su correspondiente `</div>`
   - ✅ Usar editor con auto-complete o verificar balance de etiquetas

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: "Los cambios no se ven en la UI"

**Diagnóstico**:
```bash
# Verificar que el archivo correcto fue modificado
grep -n "tu_cambio" app/page.tsx

# Si no aparece, probablemente modificaste el archivo equivocado
```

**Solución**:
1. Verificar que modificaste `app/page.tsx` (NO `context/AppContext.tsx`)
2. Reiniciar el servidor: `pkill -f "next dev" && npm run dev`
3. Hard refresh en el navegador: `Cmd+Shift+R` (Mac) o `Ctrl+Shift+R` (Windows)

### Problema 2: "Error de compilación JSX"

**Síntomas**:
```
Error: Unexpected token `main`. Expected jsx identifier
```

**Causa**: Etiquetas JSX desbalanceadas (más aperturas que cierres o viceversa)

**Solución**:
```bash
# Verificar errores de sintaxis
npx tsc --noEmit 2>&1 | grep "page.tsx"

# Buscar la línea del error y verificar:
# 1. Cada <div> tiene su </div>
# 2. Cada <Card> tiene su </Card>
# 3. No hay </div> extra
```

### Problema 3: "Los gradientes no se aplican"

**Diagnóstico**:
```typescript
// Verificar que la liga tiene el gradiente configurado
console.log(leagues.find(l => l.name === "Euroliga"))
// Debe mostrar: { name: "Euroliga", color: "#...", gradient: { enabled: true, ... } }
```

**Solución**:
1. Verificar que el código de gradiente está en AMBOS modos de renderizado
2. Buscar: `backgroundColor.*leagues.find` en `page.tsx`
3. Reemplazar con la lógica de gradiente:
```typescript
...((() => {
  const league = leagues.find((l) => l.name === fixture.league)
  if (league?.gradient?.enabled) {
    return {
      background: `linear-gradient(${league.gradient.direction}, ${league.gradient.startColor}, ${league.gradient.endColor})`,
    }
  }
  return {
    backgroundColor: fixture.leagueColor || league?.color || "#000000",
  }
})()),
```

### Problema 4: "Errores de TypeScript"

**Síntomas**:
```
error TS2304: Cannot find name 'setExportDateFontSize'
```

**Causa**: Variable renombrada o eliminada pero aún referenciada

**Solución**:
```bash
# Buscar todas las referencias
grep -n "setExportDateFontSize" app/page.tsx

# Reemplazar con la variable correcta
# Ejemplo: setExportDateFontSize → setFixtureDateFontSize
```

---

## ✅ Checklist de Verificación

### Antes de Hacer Cambios
- [ ] Leer esta guía completa
- [ ] Identificar el archivo correcto (`app/page.tsx` en el 90% de los casos)
- [ ] Buscar código similar existente para mantener consistencia
- [ ] Verificar si el cambio afecta múltiples modos de renderizado

### Durante la Edición
- [ ] Mantener el estilo de código existente (indentación, nombres de variables)
- [ ] Actualizar tipos en `types/index.ts` si es necesario
- [ ] Aplicar cambios en TODOS los lugares relevantes (Normal, Compacto, 2 Columnas)
- [ ] Verificar balance de etiquetas JSX

### Después de los Cambios
- [ ] Compilar sin errores: `npx tsc --noEmit`
- [ ] Reiniciar servidor: `pkill -f "next dev" && npm run dev`
- [ ] Probar en el navegador con hard refresh
- [ ] Verificar en TODOS los modos (Normal, Compacto, 2 Columnas)
- [ ] Probar exportación si se modificó algo relacionado

---

## 🎯 Patrones de Búsqueda Útiles

### Encontrar dónde se renderizan los fixtures
```bash
grep -n "fixturesForDate.map" app/page.tsx
# Resultado: Líneas ~1694 y ~1861
```

### Encontrar dónde se aplican estilos de liga
```bash
grep -n "backgroundColor.*league" app/page.tsx
grep -n "background.*league" app/page.tsx
```

### Encontrar todos los estados
```bash
grep -n "const \[.*useState" app/page.tsx | head -50
```

### Verificar uso de una variable
```bash
grep -n "nombreVariable" app/page.tsx
```

---

## 🚨 Advertencias Finales

1. **NO refactorizar sin permiso explícito**
   - El código es funcional aunque no esté "limpio"
   - Refactorizar puede romper funcionalidades ocultas

2. **NO asumir que componentes en `/components` se usan**
   - Muchos son legacy o no están integrados
   - Siempre verificar en `page.tsx` si se importan

3. **NO modificar `AppContext.tsx` sin sincronizar con `page.tsx`**
   - Son sistemas paralelos no sincronizados
   - Los cambios en Context NO afectan la UI principal

4. **SIEMPRE probar en los 3 modos**
   - Normal
   - Compacto
   - 2 Columnas

5. **SIEMPRE probar la exportación**
   - Los cambios visuales pueden romper html2canvas
   - Verificar que las imágenes se generen correctamente

---

## 📞 Contacto y Soporte

Si encuentras un problema no documentado aquí:
1. Buscar en el código existente patrones similares
2. Verificar que el problema no esté en la lista de "Problemas Comunes"
3. Documentar el problema y la solución para futuras referencias

---

**Última actualización**: 2025-10-11
**Versión**: 2.0
**Mantenedor**: Sistema IA

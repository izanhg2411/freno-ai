# Seguridad: medidas y límites

## API keys
- No hay claves en el código ni en el repositorio; `.gitignore` excluye `.env`.
- Se guardan en `chrome.storage.local` **sin cifrar**. Eso **no equivale a un gestor de secretos**: cualquiera con acceso a tu perfil de Chrome, o código malicioso con acceso a la extensión, podría leerlas.
- La clave solo se envía al proveedor elegido; nunca se escribe en registros ni aparece en mensajes de error (hay test).
- Recomendación: usa una clave **con límite de gasto** y revócala si dudas.
- La cabecera `anthropic-dangerous-direct-browser-access` es necesaria para llamar a Anthropic desde el navegador; el nombre refleja precisamente este riesgo.

> **Esto no es válido para un producto comercial multiusuario.** Una versión de pago necesita un backend propio (ver abajo). No debe distribuirse nunca una clave compartida dentro de la extensión.

## Arquitectura recomendada para la versión comercial
Extensión → backend propio (autenticación de usuario, cuotas y límites por plan, validación de peticiones) → proveedor de IA. Las claves del proveedor viven solo en el servidor (gestor de secretos), con registro de uso, límites de tasa y cumplimiento de privacidad.

## Resistencia a instrucciones maliciosas en ejercicios
- El enunciado, contexto, intentos y respuestas se envuelven en etiquetas y el *system prompt* los declara **datos, no instrucciones**; se neutralizan etiquetas que intenten cerrar los delimitadores.
- Lo más importante: **las transiciones no dependen de la IA**. Aunque un enunciado convenza al modelo de «dar la solución», la etapa no avanza y la solución no se solicita hasta que `flow.ts` lo autoriza.
- Límite real: una pista podría filtrar de más si el modelo es persuadido. No se puede garantizar; por eso las pistas se limitan en longitud y se piden en formato estructurado.

## Superficie de la extensión
- CSP de extensión estricta (`script-src 'self'`), sin código remoto, sin `eval`.
- Permisos mínimos; sin permisos de pestañas ni *content scripts* en esta versión.
- El texto de la IA se renderiza como texto, no como HTML.
- Se valida cada salida de la IA con esquema; un error nunca avanza de etapa.

## Lo que FRENO no puede evitar
Un estudiante puede copiar la respuesta desde otra pestaña, usar otra IA o desactivar la extensión. FRENO crea **fricción educativa**, no un bloqueo.

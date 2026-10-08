DULCECESTA ONLINE — versión 4
================================

Esta versión mantiene el diseño de la página que ya probaste y prepara la tienda
para funcionar con varios teléfonos usando Supabase como base de datos.

INCLUYE
-------
- Catálogo público.
- Búsqueda.
- Carrito.
- Pedidos compartidos online.
- Inventario compartido.
- Descuento automático de stock al crear un pedido.
- Panel de administrador.
- Inicio de sesión del administrador.
- Estados de pedido: Pendiente, Preparando, Entregado, Cancelado.
- Subida de fotos de productos desde el teléfono.
- Modo DEMO local si config.js está vacío.

IMPORTANTE
----------
Para que sea una tienda REAL, hay que conectar Supabase y publicar estos archivos.
No pongas una service_role/secret key en config.js. Solo usa la Project URL y
la Publishable/Anon key.

PASO 1 — CREAR LA BASE DE DATOS
--------------------------------
1. Crea un proyecto en Supabase.
2. Abre SQL Editor.
3. Copia TODO el contenido de supabase.sql y ejecútalo.
4. Ve a Authentication > Users.
5. Crea el usuario que será el administrador (correo + contraseña).
6. Copia el UUID de ese usuario.
7. En SQL Editor ejecuta:
   insert into public.profiles(id,role) values ('UUID-AQUI','admin')
   on conflict (id) do update set role='admin';

PASO 2 — CONECTAR LA WEB
-------------------------
1. En Supabase busca Project Settings / API.
2. Copia Project URL.
3. Copia la Publishable key (o la anon key si tu proyecto la muestra).
4. Abre config.js y pega:
   window.DULCECESTA_CONFIG = {
     supabaseUrl: "TU_URL",
     supabaseKey: "TU_KEY"
   };

PASO 3 — PROBAR
----------------
Abre index.html.
- Como cliente, el catálogo debe cargar desde Supabase.
- Pulsa Admin e inicia sesión con el usuario creado.
- Agrega un producto con foto.
- Desde otro teléfono, abre la misma página: ambos deben ver el mismo inventario.
- Haz un pedido desde el teléfono del cliente.
- El administrador debe verlo en Pedidos y el stock debe disminuir.

PASO 4 — PUBLICAR
-----------------
Puedes publicar estos archivos como un sitio estático, por ejemplo en GitHub Pages.
El sitio publicado usa Supabase para los datos.

SEGURIDAD
---------
- RLS está incluido en supabase.sql.
- El cliente no recibe la contraseña del administrador.
- El cliente solo puede consultar productos activos.
- Los pedidos se crean mediante una función de base de datos que valida el stock.
- La service_role/secret key NUNCA debe ir en el navegador.

PRÓXIMA MEJORA
--------------
Después de ponerlo online podemos añadir:
- botón de WhatsApp para confirmar pedidos,
- logo/fotos reales del negocio,
- categorías,
- ofertas,
- historial de ventas,
- estadísticas de ventas,
- dominio propio.

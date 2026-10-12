---
paths:
  - "vercel.json"
  - "middleware.ts"
  - "lib/supabase/**"
---

# Región y middleware

**La app corre en Dublín porque la base está en Irlanda** (`vercel.json`,
`regions: ["dub1"]`). Sin eso Vercel la ponía en Washington y cada consulta
desde el servidor cruzaba el Atlántico: 1,3–3,5 s en empezar a responder. Si
algún día la base se muda, se muda esto con ella. Y **cada consulta a la base
que se añada al middleware la pagan todas las navegaciones**: lo que el
servidor necesite saber en cada petición debe viajar en la sesión
(`app_metadata`, que escribe la base; nunca `user_metadata`, que lo edita el
usuario). Para comprobar dónde corre, mirar la cabecera `x-vercel-id` de una
respuesta: `cdg1::dub1` es «entró por París, se ejecutó en Dublín».

-- Campos de Object ID (norma internacional para describir objetos de arte) que faltaban.
ALTER TABLE works ADD COLUMN artform TEXT;        -- tipo de objeto: Pintura, Dibujo, Escultura…
ALTER TABLE works ADD COLUMN inscriptions TEXT;   -- inscripciones y marcas: firma, fecha, sellos, etiquetas
ALTER TABLE works ADD COLUMN features TEXT;       -- rasgos distintivos: lo que permite reconocer ESTA pieza

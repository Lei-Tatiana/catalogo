import express from "express";
import mysql, { type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import dotenv from "dotenv";
import path from "node:path";


const raiz = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(raiz, ".env") });

const app = express();
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
});


app.use(express.static(path.join(raiz, "public")));


function validarProducto(body: any) {
  const { nombre, idCategoria, precio, stock } = body ?? {};
  const nombreValido =
    typeof nombre === "string" && nombre.trim().length > 0 && nombre.trim().length <= 100;
  const precioValido =
    typeof precio === "number" &&
    Number.isFinite(precio) &&
    precio >= 0 &&
    precio <= 99999999.99 &&
    Math.abs(precio * 100 - Math.round(precio * 100)) < 0.000001;
  if (
    !nombreValido ||
    !Number.isInteger(idCategoria) || idCategoria < 1 ||
    !precioValido ||
    !Number.isInteger(stock) || stock < 0 || stock > 2147483647
  ) {
    return null;
  }
  return {
    nombre: nombre.trim() as string,
    idCategoria: idCategoria as number,
    precio: precio as number,
    stock: stock as number,
  };
}

async function categoriaExiste(id: number): Promise<boolean> {
  const [filas] = await pool.execute<RowDataPacket[]>(
    "SELECT id_categoria FROM categorias WHERE id_categoria = ?",
    [id]
  );
  return filas.length > 0;
}

app.get("/api/categorias", async (_req, res) => {
  try {
    const [filas] = await pool.execute<RowDataPacket[]>(
      "SELECT id_categoria, categoria FROM categorias ORDER BY categoria"
    );
    res.json(filas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudieron leer las categorías." });
  }
});

app.get("/api/productos", async (_req, res) => {
  try {
    const [filas] = await pool.execute<RowDataPacket[]>(`
      SELECT p.id_productos, p.nombre, p.id_categoria, c.categoria,
             p.precio, p.stock
      FROM productos p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      ORDER BY p.id_productos
    `);
    res.json(
      filas.map((f) => ({
        id: f.id_productos,
        nombre: f.nombre,
        idCategoria: f.id_categoria,
        categoria: f.categoria ?? "Sin categoría",
        precio: Number(f.precio),
        stock: f.stock,
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudieron leer los productos." });
  }
});

app.post("/api/productos", async (req, res) => {
  const d = validarProducto(req.body);
  if (!d) {
    res.status(400).json({ mensaje: "Revisen los datos del producto." });
    return;
  }
  try {
    if (!(await categoriaExiste(d.idCategoria))) {
      res.status(400).json({ mensaje: "La categoría no existe." });
      return;
    }
    await pool.execute(
      "INSERT INTO productos (nombre, id_categoria, precio, stock) VALUES (?, ?, ?, ?)",
      [d.nombre, d.idCategoria, d.precio, d.stock]
    );
    res.status(201).json({ mensaje: "Producto guardado." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo guardar el producto." });
  }
});

app.put("/api/productos/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = validarProducto(req.body);
  if (!Number.isInteger(id) || !d) {
    res.status(400).json({ mensaje: "Revisen los datos del producto." });
    return;
  }
  try {
    if (!(await categoriaExiste(d.idCategoria))) {
      res.status(400).json({ mensaje: "La categoría no existe." });
      return;
    }
    const [r] = await pool.execute<ResultSetHeader>(
      `UPDATE productos SET nombre = ?, id_categoria = ?, precio = ?, stock = ?
       WHERE id_productos = ?`,
      [d.nombre, d.idCategoria, d.precio, d.stock, id]
    );
    if (r.affectedRows === 0) {
      res.status(404).json({ mensaje: "No existe el producto." });
      return;
    }
    res.json({ mensaje: "Producto actualizado." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo actualizar el producto." });
  }
});

app.delete("/api/productos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ mensaje: "Id inválido." });
    return;
  }
  try {
    const [r] = await pool.execute<ResultSetHeader>(
      "DELETE FROM productos WHERE id_productos = ?",
      [id]
    );
    if (r.affectedRows === 0) {
      res.status(404).json({ mensaje: "No existe el producto." });
      return;
    }
    res.json({ mensaje: "Producto eliminado." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "No se pudo eliminar el producto." });
  }
});


async function iniciar(): Promise<void> {
  const puerto = Number(process.env.PORT ?? 3000);
  try {
    await pool.query("SELECT 1");
    app.listen(puerto, "0.0.0.0", () => {
      console.log(`Catálogo disponible en http://localhost:${puerto}`);
    });
  } catch (error) {
    console.error("No se pudo conectar con MariaDB. Revisá el archivo .env", error);
    await pool.end();
    process.exitCode = 1;
  }
}

void iniciar();
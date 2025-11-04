import fs from "fs";
import path from "path";
import { pool } from "./db.js";

async function importCars() {
  try {
    console.log("🚗 Importing cars into database...");

    const filePath = path.resolve("cars.json");
    const rawData = fs.readFileSync(filePath, "utf-8");
    const carsData = JSON.parse(rawData);

    for (const [brandName, models] of Object.entries(carsData)) {

      const brandResult = await pool.query(
        `INSERT INTO brands (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [brandName]
      );
      const brandId = brandResult.rows[0].id;

      for (const [modelName, car] of Object.entries(models)) {
        const { year, engine, horsePower, gearbox, price, image } = car;

        await pool.query(
          `INSERT INTO cars (brand_id, model, year, engine, horse_power, gearbox, price, image)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [brandId, modelName, year, engine, horsePower, gearbox, price, image]
        );
      }
    }

    console.log("✅ Import completed successfully!");
  } catch (err) {
    console.error("❌ Import error:", err.message);
  } finally {
    await pool.end();
  }
}

importCars();

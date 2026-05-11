import mongoose from 'mongoose';

const sourceUri = 'mongodb+srv://bharathbooshan91533_db_user:YrJmUNLgfAUzOrpt@cluster0.h747xek.mongodb.net/food';
const targetUri = 'mongodb+srv://foodapp:foodapp@cluster0.ozk3k1y.mongodb.net/Cluster0';

async function migrateAll() {
  console.log('Connecting to Source DB...');
  const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
  console.log('Connecting to Target DB...');
  const targetConn = await mongoose.createConnection(targetUri).asPromise();

  try {
    const sourceDb = sourceConn.db;
    const targetDb = targetConn.db;

    const collections = await sourceDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections in source DB.`);

    for (const colInfo of collections) {
      const colName = colInfo.name;
      console.log(`\nMigrating collection: ${colName}`);

      const sourceCol = sourceDb.collection(colName);
      const targetCol = targetDb.collection(colName);

      // Get all documents from source
      const docs = await sourceCol.find({}).toArray();
      console.log(`- Found ${docs.length} documents.`);

      if (docs.length > 0) {
        // Clear target collection
        console.log(`- Clearing target collection ${colName}...`);
        await targetCol.deleteMany({});

        // Insert into target
        console.log(`- Inserting ${docs.length} documents into target...`);
        await targetCol.insertMany(docs, { ordered: false });
        console.log(`- Migration for ${colName} complete.`);
      } else {
        console.log(`- Collection ${colName} is empty, skipping.`);
      }
    }

    console.log('\n========================================');
    console.log('MIGRATION COMPLETE!');
    console.log('========================================');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sourceConn.close();
    await targetConn.close();
    process.exit(0);
  }
}

migrateAll().catch(console.error);

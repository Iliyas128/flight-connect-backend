import dotenv from 'dotenv';
import { connectDB } from '../config/database';
import { User } from '../models/User';

dotenv.config();

const createAdmin = async () => {
  try {
    await connectDB();

    const username = process.argv[2] || 'admin';
    const password = process.argv[3] || 'admin123';
    const name = process.argv[4] || 'Администратор';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ username: username.toLowerCase() });
    if (existingAdmin) {
      console.log('❌ Администратор с таким именем пользователя уже существует');
      process.exit(1);
    }

    // Create admin user
    // Password will be hashed automatically by the pre-save hook in User model
    const admin = new User({
      id: Math.random().toString(36).substring(2, 11),
      username: username.toLowerCase(),
      password: password, // Will be hashed by pre-save hook
      role: 'admin',
      name,
    });

    await admin.save();

    console.log('✅ Администратор успешно создан!');
    console.log(`   Имя пользователя: ${username}`);
    console.log(`   Пароль: ${password}`);
    console.log(`   Имя: ${name}`);
    console.log('\n⚠️  Сохраните эти данные в безопасном месте!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при создании администратора:', error);
    process.exit(1);
  }
};

createAdmin();

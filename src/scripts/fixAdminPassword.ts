import dotenv from 'dotenv';
import { connectDB } from '../config/database';
import { User } from '../models/User';

dotenv.config();

const fixAdminPassword = async () => {
  try {
    await connectDB();

    const username = process.argv[2] || 'admin';
    const newPassword = process.argv[3];

    if (!newPassword) {
      console.log('❌ Укажите новый пароль: npm run fix-admin-password [username] [newPassword]');
      process.exit(1);
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      console.log(`❌ Пользователь с именем "${username}" не найден`);
      process.exit(1);
    }

    // Update password - it will be hashed by pre-save hook
    user.password = newPassword;
    await user.save();

    console.log('✅ Пароль успешно обновлен!');
    console.log(`   Имя пользователя: ${username}`);
    console.log(`   Новый пароль: ${newPassword}`);
    console.log(`   Роль: ${user.role}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при обновлении пароля:', error);
    process.exit(1);
  }
};

fixAdminPassword();

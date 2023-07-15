require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysqldump = require('mysqldump');
const sgMail = require('@sendgrid/mail');



// Backup directory
const BACKUP_DIR = process.env.BACKUP_DIR;

// SendGrid API key and email addresses
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const TO_EMAIL = process.env.TO_EMAIL;

// Configure SendGrid
sgMail.setApiKey(SENDGRID_API_KEY);

// Backup database function
async function backupDatabase() {
  try {
    // Create backup filename with timestamp
    const backupFilename = `backup_${new Date().toISOString().replace(/[-:.]/g, '')}.sql`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    //Perform the database backup
    await mysqldump({
      connection: {
        host: process.env.REMOTE_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      },
      dumpToFile: backupPath
    });

    console.log('Database backup completed successfully');

    // Delete backups older than 30 days
    deleteOldBackups();

  } catch (error) {
    console.error('An error occurred during the database backup:', error);
    sendErrorEmail(error);
  }
}

// Delete backups older than 30 days
function deleteOldBackups() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  fs.readdir(BACKUP_DIR, (err, files) => {
    if (err) {
      console.error('An error occurred while reading backup directory:', err);
      return;
    }

    files.forEach(file => {
      if (file === '.gitkeep') {
        // Skip the .gitkeep file
        return;
      }

      const filePath = path.join(BACKUP_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error(`An error occurred while retrieving stats for file ${file}:`, err);
          return;
        }

        console.log(stats)

        if (stats.isFile() && stats.ctime < thirtyDaysAgo) {
          fs.unlink(filePath, err => {
            if (err) {
              console.error(`An error occurred while deleting file ${file}:`, err);
            } else {
              console.log(`Deleted file: ${file}`);
            }
          });
        }
      });
    });
  });
}

// Send error email function
function sendErrorEmail(error) {
  const msg = {
    to: TO_EMAIL,
    from: FROM_EMAIL,
    subject: 'Error occurred during database backup',
    text: `An error occurred during the database backup:\n\n${error}`
  };

  sgMail.send(msg)
    .then(() => {
      console.log('Error email sent successfully');
    })
    .catch((err) => {
      console.error('An error occurred while sending the error email:', err);
    });
}

// Trigger the backup process
backupDatabase();

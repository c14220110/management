import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'harisay@gmail.com',
    pass: 'vefr elhx pbkh jqlb'
  }
});

export async function sendEmail({ to, subject, html }) {
  if (!to || to.length === 0) {
    console.log('No recipients for email');
    return;
  }
  
  const mailOptions = {
    from: '"GKI Management System" <harisay@gmail.com>',
    to: Array.isArray(to) ? to.join(',') : to,
    subject,
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    return null;
  }
}

export async function getManagementEmails(requiredPrivilege) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // 1. Get all profiles with role 'management'
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, privileges')
      .eq('role', 'management');
    
    if (error || !profiles) {
      console.error('Error fetching management profiles:', error);
      return [];
    }

    // 2. Filter profiles based on privilege
    const targetUserIds = profiles
      .filter(p => {
        // If privileges is null/undefined, assume full access (Super Admin)
        if (!p.privileges) return true;
        
        // If privileges is array, check if it includes requiredPrivilege
        if (Array.isArray(p.privileges)) {
           return p.privileges.includes(requiredPrivilege);
        }
        return false;
      })
      .map(p => p.id);

    if (targetUserIds.length === 0) return [];

    // 3. Get emails for these users using Admin API
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
      perPage: 1000
    });
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return [];
    }

    const emails = users
      .filter(u => targetUserIds.includes(u.id))
      .map(u => u.email)
      .filter(email => email); // Ensure no null emails
      
    return emails;
  } catch (err) {
    console.error("Error in getManagementEmails:", err);
    return [];
  }
}

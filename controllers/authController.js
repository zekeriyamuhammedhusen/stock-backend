    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const crypto = require('crypto');
    const nodemailer = require('nodemailer');
    const User = require('../models/User');

    const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    });

    const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('Login attempt:', { email });

        if (!email || !password) {
        console.log('Login failed: Email and password are required');
        return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email }).populate('roles');
        if (!user) {
        console.log('Login failed: User not found:', email);
        return res.status(401).json({ error: 'Invalid email or password' });
        }

        console.log('Found user:', { email, roles: user.roles.map(r => r.name) });

        // Check if user is active
        if (user.status === 'inactive') {
        console.log('Login failed: User account is deactivated:', email);
        return res.status(403).json({ error: 'Your account has been deactivated. Please contact an administrator.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
        console.log('Login failed: Incorrect password for:', email);
        return res.status(401).json({ error: 'Invalid email or password' });
        }

        const roles = user.roles.map(role => role.name.toLowerCase());
        const token = jwt.sign(
        { userId: user._id, roles },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '1h' }
        );
        console.log('Login successful, token generated:', { userId: user._id, roles });

        res.status(200).json({ token });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };

    const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        console.log('Forgot password request:', { email });

        if (!email) {
        console.log('Forgot password failed: Email is required');
        return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
        console.log('Forgot password failed: User not found:', email);
        return res.status(404).json({ error: 'User not found' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetPasswordExpires = Date.now() + 3600000; // 1 hour expiry

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetPasswordExpires;
        await user.save();
        console.log('Reset token generated for:', { email, resetToken });

                const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
                const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'StockMe | Password Reset Request',
                text: `StockMe Password Reset\n\nYou requested a password reset. Click this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
                html: `
                    <div style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#102a43;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(16,42,67,0.08);">
                            <tr>
                                <td style="padding:22px 28px;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#ffffff;">
                                    <div style="font-size:28px;font-weight:700;letter-spacing:0.6px;">StockMe</div>
                                    <div style="margin-top:6px;font-size:13px;opacity:0.9;">Smart Stock Management</div>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:28px;">
                                    <h2 style="margin:0 0 14px 0;font-size:22px;color:#0f172a;">Reset Your Password</h2>
                                    <p style="margin:0 0 14px 0;line-height:1.6;font-size:15px;color:#334e68;">
                                        We received a request to reset your StockMe account password.
                                    </p>
                                    <p style="margin:0 0 24px 0;line-height:1.6;font-size:15px;color:#334e68;">
                                        Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
                                    </p>
                                    <a href="${resetUrl}" style="display:inline-block;padding:12px 22px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">Reset Password</a>
                                    <p style="margin:24px 0 8px 0;line-height:1.6;font-size:13px;color:#486581;word-break:break-all;">
                                        If the button does not work, copy and paste this link into your browser:<br />
                                        <a href="${resetUrl}" style="color:#1d4ed8;">${resetUrl}</a>
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:16px 28px;background:#f8fafc;color:#627d98;font-size:12px;line-height:1.5;border-top:1px solid #e6edf5;">
                                    If you did not request this password reset, you can safely ignore this email.
                                </td>
                            </tr>
                        </table>
                    </div>
                `,
                };

        await transporter.sendMail(mailOptions);
        console.log('Password reset email sent to:', email);

        res.status(200).json({ message: 'Password reset link sent to your email' });
    } catch (error) {
        console.error('Forgot password error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };

    const resetPassword = async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        console.log('Reset password request:', { email });

        if (!email || !token || !newPassword) {
        console.log('Reset password failed: Email, token, and new password are required');
        return res.status(400).json({ error: 'Email, token, and new password are required' });
        }

        const user = await User.findOne({
        email,
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
        console.log('Reset password failed: Invalid or expired token for:', email);
        return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();
        console.log('Password reset successful for:', email);

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };

    const logout = async (req, res) => {
    // JWT is stateless in this app, so logout is handled client-side by clearing token.
    return res.status(200).json({ message: 'Logged out successfully' });
    };

    module.exports = { login, forgotPassword, resetPassword, logout };
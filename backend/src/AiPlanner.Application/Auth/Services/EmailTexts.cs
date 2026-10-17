namespace AiPlanner.Application.Auth.Services;

/// <summary>
/// The app's emails in the user's language (User.Locale; the apps' languages -
/// shared/i18n LANGUAGES). {code} is the 6-digit code. Unknown languages: English.
/// </summary>
public sealed record EmailTexts(string VerifySubject, string VerifyBody, string ResetSubject, string ResetBody)
{
    public static EmailTexts For(string? locale) =>
        (locale ?? "").Split('-', '_')[0].ToLowerInvariant() switch
        {
            "es" => new("Tu código de Gatazee: {code}", "Tu código para confirmar el correo en Gatazee es {code}.\nCaduca en 15 minutos. Si no fuiste tú, ignora este mensaje.",
                "Restablecer la contraseña de Gatazee: {code}", "Tu código para restablecer la contraseña de Gatazee es {code}.\nCaduca en 15 minutos. Si no lo pediste, ignora este mensaje: tu contraseña no cambia."),
            "fr" => new("Votre code Gatazee : {code}", "Votre code pour confirmer votre e-mail sur Gatazee est {code}.\nIl expire dans 15 minutes. Si ce n’était pas vous, ignorez ce message.",
                "Réinitialiser le mot de passe Gatazee : {code}", "Votre code pour réinitialiser le mot de passe Gatazee est {code}.\nIl expire dans 15 minutes. Si vous ne l’avez pas demandé, ignorez ce message : votre mot de passe ne change pas."),
            "de" => new("Dein Gatazee-Code: {code}", "Dein Code zum Bestätigen deiner E-Mail bei Gatazee ist {code}.\nEr läuft in 15 Minuten ab. Wenn du das nicht warst, ignoriere diese Nachricht.",
                "Gatazee-Passwort zurücksetzen: {code}", "Dein Code zum Zurücksetzen deines Gatazee-Passworts ist {code}.\nEr läuft in 15 Minuten ab. Wenn du das nicht angefordert hast, ignoriere diese Nachricht – dein Passwort bleibt gleich."),
            "pt" => new("Seu código do Gatazee: {code}", "Seu código para confirmar o e-mail no Gatazee é {code}.\nEle expira em 15 minutos. Se não foi você, ignore esta mensagem.",
                "Redefinir a senha do Gatazee: {code}", "Seu código para redefinir a senha do Gatazee é {code}.\nEle expira em 15 minutos. Se você não pediu, ignore esta mensagem: sua senha não muda."),
            "it" => new("Il tuo codice Gatazee: {code}", "Il tuo codice per confermare l’email su Gatazee è {code}.\nScade tra 15 minuti. Se non sei stato tu, ignora questo messaggio.",
                "Reimposta la password di Gatazee: {code}", "Il tuo codice per reimpostare la password di Gatazee è {code}.\nScade tra 15 minuti. Se non l’hai chiesto tu, ignora questo messaggio: la password non cambia."),
            "pl" => new("Twój kod Gatazee: {code}", "Twój kod do potwierdzenia e-maila w Gatazee to {code}.\nWygasa za 15 minut. Jeśli to nie Ty, zignoruj tę wiadomość.",
                "Reset hasła Gatazee: {code}", "Twój kod do zresetowania hasła w Gatazee to {code}.\nWygasa za 15 minut. Jeśli o to nie prosiłeś, zignoruj tę wiadomość – hasło się nie zmieni."),
            "ro" => new("Codul tău Gatazee: {code}", "Codul tău pentru confirmarea e-mailului în Gatazee este {code}.\nExpiră în 15 minute. Dacă nu ai fost tu, ignoră acest mesaj.",
                "Resetarea parolei Gatazee: {code}", "Codul tău pentru resetarea parolei Gatazee este {code}.\nExpiră în 15 minute. Dacă nu l-ai cerut, ignoră acest mesaj – parola nu se schimbă."),
            "uk" => new("Ваш код Gatazee: {code}", "Ваш код для підтвердження пошти в Gatazee — {code}.\nВін дійсний 15 хвилин. Якщо це були не ви, просто ігноруйте цей лист.",
                "Скидання пароля Gatazee: {code}", "Ваш код для скидання пароля Gatazee — {code}.\nВін дійсний 15 хвилин. Якщо ви цього не просили, ігноруйте лист — пароль не зміниться."),
            "ru" => new("Ваш код Gatazee: {code}", "Ваш код для подтверждения почты в Gatazee — {code}.\nОн действует 15 минут. Если это были не вы, просто проигнорируйте письмо.",
                "Сброс пароля Gatazee: {code}", "Ваш код для сброса пароля Gatazee — {code}.\nОн действует 15 минут. Если вы этого не запрашивали, проигнорируйте письмо — пароль не изменится."),
            "tr" => new("Gatazee kodunuz: {code}", "Gatazee’de e-postanızı onaylama kodunuz {code}.\n15 dakika içinde geçerliliğini yitirir. Siz değilseniz bu mesajı yok sayın.",
                "Gatazee şifre sıfırlama: {code}", "Gatazee şifrenizi sıfırlama kodunuz {code}.\n15 dakika içinde geçerliliğini yitirir. Siz istemediyseniz bu mesajı yok sayın - şifreniz değişmez."),
            "he" or "iw" => new("הקוד שלך ל-Gatazee: {code}", "הקוד לאישור האימייל שלך ב-Gatazee הוא {code}.\nהוא בתוקף ל-15 דקות. אם זה לא היית את/ה, אפשר להתעלם מההודעה.",
                "איפוס הסיסמה ל-Gatazee: {code}", "הקוד לאיפוס הסיסמה שלך ב-Gatazee הוא {code}.\nהוא בתוקף ל-15 דקות. אם לא ביקשת, אפשר להתעלם - הסיסמה לא תשתנה."),
            "ar" => new("رمزك في Gatazee: {code}", "رمز تأكيد بريدك الإلكتروني في Gatazee هو {code}.\nتنتهي صلاحيته بعد 15 دقيقة. إن لم تكن أنت، فتجاهل هذه الرسالة.",
                "إعادة تعيين كلمة مرور Gatazee: {code}", "رمز إعادة تعيين كلمة مرور Gatazee هو {code}.\nتنتهي صلاحيته بعد 15 دقيقة. إن لم تطلبه، فتجاهل هذه الرسالة - لن تتغير كلمة مرورك."),
            "hi" => new("आपका Gatazee कोड: {code}", "Gatazee में आपका ईमेल पक्का करने का कोड {code} है।\nयह 15 मिनट तक मान्य है। अगर यह आपने नहीं किया, तो इस संदेश को अनदेखा करें।",
                "Gatazee पासवर्ड रीसेट: {code}", "Gatazee पासवर्ड रीसेट करने का आपका कोड {code} है।\nयह 15 मिनट तक मान्य है। अगर आपने नहीं माँगा, तो इसे अनदेखा करें - आपका पासवर्ड नहीं बदलेगा।"),
            "zh" => new("你的 Gatazee 验证码：{code}", "你在 Gatazee 确认邮箱的验证码是 {code}。\n15 分钟内有效。如果不是你本人操作，请忽略此邮件。",
                "重置 Gatazee 密码：{code}", "你重置 Gatazee 密码的验证码是 {code}。\n15 分钟内有效。如果不是你申请的，请忽略此邮件，你的密码不会改变。"),
            "ja" => new("Gatazee の確認コード：{code}", "Gatazee でメールアドレスを確認するコードは {code} です。\n15分間有効です。心当たりがない場合は、このメールを無視してください。",
                "Gatazee のパスワード再設定：{code}", "Gatazee のパスワードを再設定するコードは {code} です。\n15分間有効です。心当たりがない場合は無視してください。パスワードは変わりません。"),
            "ko" => new("Gatazee 인증 코드: {code}", "Gatazee 이메일 확인 코드는 {code}입니다.\n15분 동안 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.",
                "Gatazee 비밀번호 재설정: {code}", "Gatazee 비밀번호 재설정 코드는 {code}입니다.\n15분 동안 유효합니다. 요청하지 않았다면 무시하세요. 비밀번호는 바뀌지 않습니다."),
            _ => new("Your Gatazee code: {code}", "Your code to confirm your email for Gatazee is {code}.\nIt expires in 15 minutes. If this wasn’t you, ignore this message.",
                "Reset your Gatazee password: {code}", "Your code to reset your Gatazee password is {code}.\nIt expires in 15 minutes. If you didn’t ask for it, ignore this message - your password doesn’t change."),
        };

    public static string Fill(string text, string code) => text.Replace("{code}", code);
}

# 📊 MongoDB - قاعدة بيانات مجانية

## **البيانات بتُحفظ هنا 100%**

---

## ✅ الخطوة 1: أنشئ حساب MongoDB

1. اذهب لـ https://www.mongodb.com/cloud/atlas
2. اضغط **Sign Up (Free)**
3. أنشئ حساب بريد إلكتروني

---

## ✅ الخطوة 2: أنشئ Cluster

1. بعد التسجيل، اضغط **Create a Deployment**
2. اختر **M0 Free** (مجاني تماماً)
3. اختر أي Region (الأقرب: Singapore أو Middle East)
4. اضغط **Create**

---

## ✅ الخطوة 3: إنشاء User

1. اذهب لـ **Database Access**
2. اضغط **Add New Database User**
3. اكتب:
   - **Username:** `amazon-admin`
   - **Password:** كلمة سر قوية (اكتبها في مكان آمن)
4. اضغط **Add User**

---

## ✅ الخطوة 4: السماح بالاتصالات

1. اذهب لـ **Network Access**
2. اضغط **Add IP Address**
3. اختر **Allow access from anywhere** (0.0.0.0/0)
4. اضغط **Confirm**

---

## ✅ الخطوة 5: احصل على الرابط

1. اذهب لـ **Database** (أو **Clusters**)
2. اضغط على الـ Cluster اللي أنشأته
3. اضغط **Connect**
4. اختر **Drivers** → **Node.js**
5. انسخ الرابط اللي يشبه:
```
mongodb+srv://amazon-admin:PASSWORD@cluster0.xxx.mongodb.net/amazon-reviewer?retryWrites=true&w=majority
```

**استبدل:**
- `PASSWORD` بكلمة السر اللي أنشأتها
- `amazon-reviewer` باسم قاعدة البيانات

---

## ✅ الخطوة 6: ضع الرابط في Render

1. اذهب لـ **Render Dashboard**
2. اختر **Web Service**
3. اضغط **Environment**
4. أضف متغير جديد:
   - **Key:** `MONGODB_URI`
   - **Value:** الرابط اللي نسخته
5. اضغط **Save**

---

## 🎯 الآن البيانات محفوظة!

### ✅ الباحث يملأ المنتجات:
- البيانات تُحفظ في MongoDB

### ✅ المشتري يراجع:
- البيانات تظهر له من MongoDB

### ✅ لو توقف الخادم:
- البيانات **بتبقى موجودة** في MongoDB

---

## 📌 ملاحظات:

1. **مجاني تماماً** - MongoDB Free Tier
2. **آمن** - بيانات محفوظة في السحاب
3. **متاح 24/7** - البيانات دائماً متوفرة
4. **لا توجد حدود** - للاستخدام الخفيف

---

## 🔍 التحقق من البيانات:

### من Render:
1. اذهب لـ **Web Service**
2. اختر **Logs**
3. شوف الرسائل

### من MongoDB:
1. اذهب لـ **Collections**
2. شوف البيانات المحفوظة مباشرة

---

## ⚠️ إذا حصلت مشكلة:

### "Cannot connect to MongoDB"
- تأكد من الرابط صحيح
- تأكد من كلمة السر صحيحة
- تأكد من Network Access مفتوح

### البيانات ما بتظهر:
- تأكد من الرابط في Render Environment
- اضغط **Redeploy** على Render

---

## ✅ سهل كده!

كل ما تملأ البيانات → تُحفظ في MongoDB → دائماً متاحة! 🎉

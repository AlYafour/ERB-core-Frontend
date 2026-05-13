# UI Components Design System

## نظرة عامة

تم إنشاء نظام تصميم موحد ومتكامل لجميع مكونات الواجهة الأمامية باستخدام نظام ألوان البرتقالي والرمادي.

## نظام الألوان

### Primary Colors (Orange)
- `--orange-primary: #FF7A00`
- `--orange-burnt: #E66900`
- `--orange-hover: #E66900`

### Neutrals (Gray System)
- `--gray-light: #F4F4F4`
- `--gray-medium: #C7C7C7`
- `--gray-dark: #1F1F1F`

### Base Backgrounds
- `--white: #FFFFFF`
- `--off-white: #FAFAFA`

## المكونات الأساسية (Base Components)

### BaseButton
مكون أساسي للأزرار يمكن البناء عليه.

### BaseInput
مكون أساسي لحقول الإدخال.

### BaseModal
مكون أساسي للنوافذ المنبثقة.

## المكونات المتاحة

### Buttons
- `Button` - زر عام
- `PrimaryButton` - زر أساسي
- `SecondaryButton` - زر ثانوي
- `GhostButton` - زر شفاف
- `IconButton` - زر أيقونة

### Inputs
- `TextField` - حقل نص
- `TextArea` - منطقة نص
- `PasswordField` - حقل كلمة مرور

### Selection Controls
- `Checkbox` - مربع اختيار
- `RadioButton` - زر اختيار
- `RadioGroup` - مجموعة أزرار اختيار

### Feedback
- `Loader` / `Spinner` - مؤشر تحميل
- `ProgressBar` - شريط تقدم
- `Tooltip` - تلميح

### Structure
- `Tabs` - تبويبات
- `Badge` - شارة

## أمثلة الاستخدام

```tsx
import { Button, TextField, Checkbox, Badge } from '@/components/ui';

// Button
<Button variant="primary" size="md">Click Me</Button>

// Input
<TextField label="Name" placeholder="Enter your name" />

// Checkbox
<Checkbox label="I agree to terms" />

// Badge
<Badge variant="success">Active</Badge>
```


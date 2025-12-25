#include <Wire.h>
#include <LiquidCrystal_I2C.h>


int speaker = 32;
int flameSensor = 17; // Chân analog kết nối với cảm biến lửa
int led = 26;
int infraredSensor = 19;
int peopleCount = 0;
bool isPersonDetected = false;
LiquidCrystal_I2C lcd(0x27, 16, 2); // I2C address 0x27, 16 column and 2 rows
void setup() {
  pinMode(flameSensor, INPUT);
  pinMode(speaker, OUTPUT);
  pinMode(led, OUTPUT);
  pinMode(infraredSensor, INPUT);
  Serial.begin(9600);
  lcd.init();
  lcd.backlight();
}

void loop() {
  int flameValue = analogRead(flameSensor); // Đọc giá trị từ cảm biến lửa
  int infraredValue = digitalRead(infraredSensor);



  if (flameValue > 500) { // Kiểm tra giá trị cảm biến lửa
    lcd.setCursor(0, 0);
    lcd.print("BAO CHAY!");
    digitalWrite(led, LOW);
    digitalWrite(speaker, HIGH);
  } else {
    lcd.setCursor(0, 0);
    lcd.print("Binh thuong");
    digitalWrite(led, HIGH);
    digitalWrite(speaker, LOW);
  }

  lcd.setCursor(0, 1);
  lcd.print("SO NGUOI: ");
  lcd.print(peopleCount);

  if (infraredValue == HIGH && !isPersonDetected) { // Kiểm tra cảm biến hồng ngoại và xem có phát hiện người mới hay không
    isPersonDetected = true;  // Đánh dấu là đã phát hiện người
    peopleCount++;  // Tăng biến đếm số người lên 1
    delay(1000); // Đợi 1 giây để tránh đếm trùng lặp
  } else if (infraredValue == LOW) { // Nếu không có người đi qua cảm biến
    isPersonDetected = false;  // Đặt biến phát hiện người về false để có thể phát hiện người mới
  }
}

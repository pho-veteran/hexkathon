-&gt; Chatbot

Usecase:

- input pdf/slide
- gen quiz (dạng text/json chuẩn format)
- input thêm yêu cầu từ user
- gen response

-&gt; Quiz App

- Chọn câu trả lời
- Nếu đúng -&gt; Trừ máu boss
- Nếu sai -&gt; Boss phản công (nhân vật user mất máu)
- Câu hỏi được phân ra dễ,vừa,khó tùy vào độ khó mà dame khác nhau
- Cố định boss là Deep dark fantasy với 1000 máu

  (thông số máu user, boss, độ khó, câu hỏi, các câu trả lời)

với phần trả lời quiz user trả  câu hỏi id, câu trả lời, bên BE nhận thì mới xử lý

ko cần duy trì session

user id, quiz id, trả lời -&gt; check dynamo trả lời (1 đúng, 3 sai) đã đc tạo bởi AI trước đó

nhấn bàn phím thôi

abcd

hoặc số 1234



Tôi chuẩn bị dựng deploy dự án trên aws, hãy tạo cho tôi terraform để deploy với kiến trúc sau:  
Route 53 -&gt; Cloudfront (Trỏ đến S3 host FE) -&gt; API gateway -&gt; VPC (multi AZ - 2 AZ) -&gt; Lambda  
Trong VPC và private subnet:  
- Lambda (chatbot) -&gt; Dynamo  
- Lambda (QuizApplication) -&gt; Dynamo  
- Các VPC endpoint  
Ngoài VPC:  
- DynamoDB: Lưu lịch sử chat + Quiz (Câu hỏi, độ khó, câu trả lời đúng, câu trả lời sai) + Quiz room (Boss health, Boss image url, User health, Câu trả lời của người dùng cho câu hỏi &lt;x&gt;).  
- S3 vector (cho knowledge base, không dùng Bedrock Knowledge base)  
- S3 host static FE  
  
Tagging:  
Project=W7Capstone  
Team=G6  
Owner=Hoang Environment=Hackathon  
Application = [tên service]-[chức năng]  
  
* Yêu cầu: Không public các resource + Least privage cho các role và SG
-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               10.4.32-MariaDB - mariadb.org binary distribution
-- Server OS:                    Win64
-- HeidiSQL Version:             12.14.0.7165
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for up_repair_system
DROP DATABASE IF EXISTS `up_repair_system`;
-- CREATE DATABASE IF NOT EXISTS `up_repair_system` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
-- USE `up_repair_system`;

-- Dumping structure for table up_repair_system.requests
DROP TABLE IF EXISTS `requests`;
CREATE TABLE IF NOT EXISTS `requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `building` varchar(50) NOT NULL COMMENT 'ชื่ออาคาร เช่น ICT, CE',
  `problem_title` varchar(200) NOT NULL COMMENT 'หัวข้อปัญหา',
  `detail` text DEFAULT NULL COMMENT 'รายละเอียดเพิ่มเติม',
  `image_path` varchar(255) DEFAULT NULL COMMENT 'เก็บชื่อไฟล์รูปภาพ',
  `status` enum('received','progress','completed') DEFAULT 'received',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `rating` int(11) DEFAULT NULL,
  `review_comment` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table up_repair_system.requests: ~2 rows (approximately)
INSERT INTO `requests` (`id`, `user_id`, `building`, `problem_title`, `detail`, `image_path`, `status`, `created_at`, `rating`, `review_comment`) VALUES
	(1, 1, 'ICT', 'แอร์ไม่เย็น ห้อง 202', 'เปิดมา 2 ชั่วโมงแล้วยังร้อน', NULL, 'received', '2026-01-23 13:58:16', NULL, NULL),
	(2, 1, 'CE', 'ไฟทางเดินดับ', 'ชั้น 3 ตรงบันไดหนีไฟ', NULL, 'completed', '2026-01-23 13:58:16', NULL, NULL);

-- Dumping structure for table up_repair_system.users
DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `role` enum('user','admin') DEFAULT 'user',
  `is_verified` tinyint(4) DEFAULT 0,
  `verification_token` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table up_repair_system.users: ~2 rows (approximately)
INSERT INTO `users` (`id`, `email`, `password`, `first_name`, `last_name`, `created_at`, `role`, `is_verified`, `verification_token`) VALUES
	(1, 'test@up.ac.th', 'CPE1234', 'kit', 'lnwza', '2026-01-23 13:58:16', 'admin', 1, NULL),
	(12, 'suphakitsaeyang9@gmail.com', '1234', 'kit', 'sae', '2026-01-27 09:21:32', 'user', 1, NULL);

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;

-- --------------------------------------------------------
-- Host:                         localhost
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


-- Dumping database structure for up_repair_system_v2
DROP DATABASE IF EXISTS `up_repair_system_v2`;
CREATE DATABASE IF NOT EXISTS `up_repair_system_v2` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
USE `up_repair_system_v2`;

-- Dumping structure for table up_repair_system_v2.buildings
DROP TABLE IF EXISTS `buildings`;
CREATE TABLE IF NOT EXISTS `buildings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL COMMENT 'ชื่ออาคาร',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table up_repair_system_v2.buildings: ~4 rows (approximately)
INSERT INTO `buildings` (`id`, `name`) VALUES
	(1, 'ICT'),
	(2, 'CE'),
	(3, 'PKY'),
	(4, 'UB');

-- Dumping structure for table up_repair_system_v2.request_images
DROP TABLE IF EXISTS `request_images`;
CREATE TABLE IF NOT EXISTS `request_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `request_id` int(11) NOT NULL,
  `image_path` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_request_images_request` (`request_id`),
  CONSTRAINT `fk_request_images_request` FOREIGN KEY (`request_id`) REFERENCES `requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table up_repair_system_v2.request_images: ~2 rows (approximately)
INSERT INTO `request_images` (`id`, `request_id`, `image_path`, `created_at`) VALUES
	(1, 3, 'img-1770699799782.jpg', '2026-02-10 05:03:19'),
	(2, 4, 'img-1770714814034.jpg', '2026-02-10 09:13:34');

-- Dumping structure for table up_repair_system_v2.requests
DROP TABLE IF EXISTS `requests`;
CREATE TABLE IF NOT EXISTS `requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `building_id` int(11) DEFAULT NULL,
  `problem_title` varchar(200) DEFAULT NULL,
  `detail` text DEFAULT NULL,
  `status_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `contact` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_requests_building` (`building_id`) USING BTREE,
  KEY `fk_requests_user` (`user_id`) USING BTREE,
  KEY `fk_requests_status` (`status_id`) USING BTREE,
  CONSTRAINT `FK_requests_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `fk_requests_building` FOREIGN KEY (`building_id`) REFERENCES `buildings` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_requests_status` FOREIGN KEY (`status_id`) REFERENCES `statuses` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table up_repair_system_v2.requests: ~8 rows (approximately)
INSERT INTO `requests` (`id`, `user_id`, `building_id`, `problem_title`, `detail`, `status_id`, `created_at`, `contact`) VALUES
	(1, 2, 1, 'แอร์ไม่เย็น', 'แอร์', 3, '2026-02-10 03:48:29', NULL),
	(3, 2, 3, 'test', 'dsfdg', 3, '2026-02-10 05:03:19', NULL),
	(4, 2, 1, 'test', 'หกดด', 3, '2026-02-10 09:13:34', NULL),
	(5, 3, 1, 'test', 'sadfg', 1, '2026-02-10 10:25:23', NULL),
	(6, 3, 1, 'test', 'asdxfc', 1, '2026-02-10 10:26:38', NULL),
	(7, 3, 1, 'test', 'w345645', 1, '2026-02-10 10:35:43', '987654321'),
	(8, 3, 2, 'test', 'wertwert', 1, '2026-02-10 10:36:28', '0987654321'),
	(9, 2, 2, 'test', 'werfgh', 3, '2026-02-10 10:37:49', '234567');

-- Dumping structure for table up_repair_system_v2.review
DROP TABLE IF EXISTS `review`;
CREATE TABLE IF NOT EXISTS `review` (
  `request_ID` int(11) DEFAULT NULL,
  `review_comment` text DEFAULT NULL,
  `rating` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table up_repair_system_v2.review: ~1 rows (approximately)
INSERT INTO `review` (`request_ID`, `review_comment`, `rating`) VALUES
	(3, 'หกฟหก', 4),
	(9, '', 4);

-- Dumping structure for table up_repair_system_v2.statuses
DROP TABLE IF EXISTS `statuses`;
CREATE TABLE IF NOT EXISTS `statuses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `statuses` enum('received','progress','completed') DEFAULT 'received',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`statuses`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table up_repair_system_v2.statuses: ~3 rows (approximately)
INSERT INTO `statuses` (`id`, `statuses`) VALUES
	(1, 'received'),
	(2, 'progress'),
	(3, 'completed');

-- Dumping structure for table up_repair_system_v2.users
DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `role` enum('user','admin') DEFAULT 'user',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Dumping data for table up_repair_system_v2.users: ~5 rows (approximately)
INSERT INTO `users` (`id`, `email`, `password`, `first_name`, `last_name`, `created_at`, `role`) VALUES
	(1, 'admin@up.ac.th', '$2b$10$4xoYCXmSMC3uSMR.9yehKeLKFqlr2H0Oz1QSiOGqCDbus8e3wkyna', 'admin', '', '2026-02-10 03:46:11', 'admin'),
	(2, '67024942@up.ac.th', '$2b$10$3OrNh53x99denkjoqO8qqOSR17SI6xEj4DP8XjPb9E06u7f78kQ0y', 'suphakit', 'saeyang', '2026-02-10 03:37:15', 'user'),
	(3, '67021758@up.ac.th', '$2b$10$nTny5fMyYH3.TYcG/4RIJObujeaOIMy.R1KrcDMRBqvmofdztJTpW', 'thanaporn', 'riamrangsan', '2026-02-10 03:38:03', 'user'),
	(4, '67026269@up.ac.th', '$2b$10$Wkq4yFzi7CufYjm7kMsW5OzdQytK/z6DXdsNMvfyVywYrXJ4Kj/oW', 'phattarawan', 'artsing', '2026-02-10 03:39:56', 'user'),
	(5, '67021770@up.ac.th', '$2b$10$pDwhdwUCdofZqtGap3aF/elyaBjdNF0M8tmKcl/9D7duhEgrLO2RC', 'thamanit', 'duangrord', '2026-02-10 03:41:02', 'user');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;

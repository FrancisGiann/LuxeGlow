-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: astrid_nails
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `about_content`
--

DROP TABLE IF EXISTS `about_content`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `about_content` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `salon_name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `mission_statement` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `about_content`
--

LOCK TABLES `about_content` WRITE;
/*!40000 ALTER TABLE `about_content` DISABLE KEYS */;
INSERT INTO `about_content` VALUES (1,'Astrid Nails','A luxury sanctuary dedicated to providing top-notch nail, lash, and spa services in a relaxing, hygienic environment.','Our mission is to elevate beauty and self-care by offering personalized, high-quality services that make every client feel refreshed, confident, and pampered.','2026-08-18 13:24:00');
/*!40000 ALTER TABLE `about_content` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointment_services`
--

DROP TABLE IF EXISTS `appointment_services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointment_services` (
  `appointment_id` varchar(50) NOT NULL,
  `service_id` varchar(50) NOT NULL,
  PRIMARY KEY (`appointment_id`,`service_id`),
  KEY `service_id` (`service_id`),
  CONSTRAINT `appointment_services_ibfk_1` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`appointment_id`) ON DELETE CASCADE,
  CONSTRAINT `appointment_services_ibfk_2` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointment_services`
--

LOCK TABLES `appointment_services` WRITE;
/*!40000 ALTER TABLE `appointment_services` DISABLE KEYS */;
INSERT INTO `appointment_services` VALUES ('BK-1037','nail-extension'),('BK-1038','gentleman-package'),('BK-1039','spa-treatment'),('BK-1040','lash-extension'),('BK-1041','gel-polish');
/*!40000 ALTER TABLE `appointment_services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `appointments` (
  `appointment_id` varchar(50) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `appointment_date` date NOT NULL,
  `appointment_time` time NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `status` enum('Pending','Confirmed','Completed','Cancelled') DEFAULT 'Pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`appointment_id`),
  KEY `customer_id` (`customer_id`),
  KEY `idx_appointment_datetime` (`appointment_date`,`appointment_time`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointments`
--

LOCK TABLES `appointments` WRITE;
/*!40000 ALTER TABLE `appointments` DISABLE KEYS */;
INSERT INTO `appointments` VALUES ('BK-1037',5,'2026-06-18','13:00:00',1500.00,'Cancelled','2026-08-15 14:56:56'),('BK-1038',4,'2026-08-30','14:00:00',1400.00,'Pending','2026-08-15 14:56:56'),('BK-1039',3,'2026-08-16','10:00:00',1200.00,'Cancelled','2026-08-15 14:56:56'),('BK-1040',2,'2026-08-15','11:30:00',1800.00,'Completed','2026-08-15 14:56:56'),('BK-1041',1,'2026-08-15','14:00:00',1500.00,'Cancelled','2026-08-15 14:56:56');
/*!40000 ALTER TABLE `appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customers` (
  `customer_id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT 0,
  `otp_code` varchar(6) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'Maria','Santos','maria.santos@email.com','0917 221 4488','$2y$12$M9WtLhJa5iO7yQ9OuhZ30O98.gV.GbMyscP.C8rMlkGVBiQsPvQoO',1,NULL,'2026-08-15 14:56:56'),(2,'Jasmine','Reyes','jasmine.reyes@email.com','0918 553 1102','$2y$12$M9WtLhJa5iO7yQ9OuhZ30O98.gV.GbMyscP.C8rMlkGVBiQsPvQoO',1,NULL,'2026-08-15 14:56:56'),(3,'Andrea','Lim','andrea.lim@email.com','0921 447 9080','$2y$12$M9WtLhJa5iO7yQ9OuhZ30O98.gV.GbMyscP.C8rMlkGVBiQsPvQoO',1,NULL,'2026-08-15 14:56:56'),(4,'Paolo','Cruz','paolo.cruz@email.com','0906 118 2277','$2y$12$M9WtLhJa5iO7yQ9OuhZ30O98.gV.GbMyscP.C8rMlkGVBiQsPvQoO',1,NULL,'2026-08-15 14:56:56'),(5,'Kim','Dela Cruz','kim.dc@email.com','0995 330 7712','$2y$12$M9WtLhJa5iO7yQ9OuhZ30O98.gV.GbMyscP.C8rMlkGVBiQsPvQoO',1,NULL,'2026-08-15 14:56:56'),(6,'sadas','asdasd','asdad@ga.com','123123123','$2y$10$ddWT531G5TLRijifmw1bYuom9eRo1TKimaeZsFWZ37PZzBuojagJy',1,NULL,'2026-08-15 15:18:09'),(7,'sadas','asdasd','francisgiann25@gmail.com','123123123','$2y$10$CKdMMsvKspYTEhGndYXJPey/bXwP89.p7VYBb4gSfoubpjwj5tARS',1,NULL,'2026-08-15 15:19:27');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_reset_tokens` (
  `reset_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `token_hash` varchar(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`reset_id`),
  UNIQUE KEY `uq_password_reset_customer` (`customer_id`),
  UNIQUE KEY `uq_password_reset_token_hash` (`token_hash`),
  KEY `idx_password_reset_expires_at` (`expires_at`),
  CONSTRAINT `fk_password_reset_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `faqs`
--

DROP TABLE IF EXISTS `faqs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `faqs` (
  `faq_id` int(11) NOT NULL AUTO_INCREMENT,
  `question` text NOT NULL,
  `answer` text NOT NULL,
  `display_order` int(11) DEFAULT 0,
  PRIMARY KEY (`faq_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `faqs`
--

LOCK TABLES `faqs` WRITE;
/*!40000 ALTER TABLE `faqs` DISABLE KEYS */;
INSERT INTO `faqs` VALUES (1,'What are your operating hours?','We are open Monday to Saturday from 10:00 AM to 8:00 PM, and Sundays from 11:00 AM to 6:00 PM.',1),(2,'What services do you offer?','Nail care, gel polish, nail extensions, lash extensions, waxing, spa treatments, massages, and curated kiddie and gentleman packages.',2),(3,'Are your products safe and hygienic?','Yes. All tools are sterilized after every client, single-use items are never reused, and we only use certified, cruelty-free products.',3),(4,'Do I need to book an appointment?','Walk-ins are welcome when slots allow, but booking online guarantees your preferred stylist and time slot.',4);
/*!40000 ALTER TABLE `faqs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `services` (
  `service_id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `duration_minutes` int(11) NOT NULL,
  `rating` decimal(2,1) DEFAULT 0.0,
  `image_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `services`
--

LOCK TABLES `services` WRITE;
/*!40000 ALTER TABLE `services` DISABLE KEYS */;
INSERT INTO `services` VALUES ('gel-polish','Gel Polish','Nails','Long lasting gel polish application',1500.00,60,4.5,NULL),('gentleman-package','Gentleman Package','Packages','Grooming essentials for gentlemen',1400.00,60,4.5,NULL),('kiddie-package','Kiddie Package','Packages','Fun and safe pampering for kids',700.00,30,4.5,NULL),('lash-extension','Lash Extension','Lashes','Volume lashes applied by certified artists',1800.00,60,5.0,NULL),('massage','Massage','Spa','Relaxing therapeutic massage',350.00,30,4.5,NULL),('nail-care','Nail Care','Nails','Basic nail care and grooming',1500.00,45,4.5,NULL),('nail-extension','Nail Extensions','Nails','Beautiful acrylic or gel extensions',1500.00,90,4.0,NULL),('spa-treatment','Spa Treatment','Spa','Relaxing foot and hand spa ritual',1200.00,60,5.0,NULL),('wax-hair-removal','Wax Hair Removal','Waxing','Gentle waxing with premium soft wax',900.00,30,4.5,NULL);
/*!40000 ALTER TABLE `services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `staff_accounts`
--

DROP TABLE IF EXISTS `staff_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `staff_accounts` (
  `account_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `position` varchar(100) NOT NULL,
  `contact_number` varchar(50) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `address` text DEFAULT NULL,
  `username` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `role` enum('Super Admin','Staff') DEFAULT 'Staff',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`account_id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `staff_accounts`
--

LOCK TABLES `staff_accounts` WRITE;
/*!40000 ALTER TABLE `staff_accounts` DISABLE KEYS */;
INSERT INTO `staff_accounts` VALUES (1,'Astrid Villanueva','Super Admin','0917 000 1122','astrid@astridnails.com','12 Mabini St, Quezon City','astrid.admin','$2y$12$/pEfryXuM0izRTBXXtMd3.FYlYsfCaXifaLXCkAPlM8Su6S/bac5y','Active','Super Admin','2026-08-15 14:56:56'),(2,'Rina Bautista','Salon Manager','0918 224 5566','rina@astridnails.com','8 Katipunan Ave, Quezon City','rina.mgr','$2y$12$fy3eDM5AkjUrCbNRYgjpxesEQI.3/2pAd0A6pg763FVpvHhDnN8Tu','Active','Staff','2026-08-15 14:56:56'),(3,'Joy Mercado','Nail Technician','0927 883 4410','joy@astridnails.com','45 Aurora Blvd, Manila','joy.tech','$2y$12$8QjwPDbcfO4tqRkxKAAP..9G2Nl8E0tQzZnWz9.DYQ7L2Yt6hnQhy','Active','Staff','2026-08-15 14:56:56'),(4,'Leah Ramos','Front Desk','0933 771 9021','leah@astridnails.com','3 Rizal St, Pasig','leah.desk','$2y$12$vRrOWKf.RhsmOTAiQe4ajOpKHN1BNfsLX0X6ut7DDwdEtUrG.HFEu','Inactive','Staff','2026-08-15 14:56:56');
/*!40000 ALTER TABLE `staff_accounts` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-18 21:26:10
